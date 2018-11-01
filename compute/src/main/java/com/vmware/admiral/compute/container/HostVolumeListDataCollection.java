/*
 * Copyright (c) 2017-2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral.compute.container;

import static com.vmware.admiral.compute.container.ContainerHostDataCollectionService.MAINTENANCE_INTERVAL_MICROS;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.vmware.admiral.adapter.common.AdapterRequest;
import com.vmware.admiral.adapter.common.ContainerHostOperationType;
import com.vmware.admiral.adapter.common.VolumeOperationType;
import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.common.util.AssertUtil;
import com.vmware.admiral.common.util.OperationUtil;
import com.vmware.admiral.common.util.QueryUtil;
import com.vmware.admiral.common.util.ServiceDocumentQuery;
import com.vmware.admiral.compute.container.volume.ContainerVolumeDescriptionService;
import com.vmware.admiral.compute.container.volume.ContainerVolumeDescriptionService.ContainerVolumeDescription;
import com.vmware.admiral.compute.container.volume.ContainerVolumeService;
import com.vmware.admiral.compute.container.volume.ContainerVolumeService.ContainerVolumeState;
import com.vmware.admiral.compute.container.volume.ContainerVolumeService.ContainerVolumeState.PowerState;
import com.vmware.admiral.compute.container.volume.VolumeUtil;
import com.vmware.admiral.service.common.DefaultSubStage;
import com.vmware.admiral.service.common.ServiceTaskCallback;
import com.vmware.admiral.service.common.ServiceTaskCallback.ServiceTaskCallbackResponse;
import com.vmware.admiral.service.common.TaskServiceDocument;
import com.vmware.photon.controller.model.resources.ComputeService.ComputeState;
import com.vmware.xenon.common.LocalizableValidationException;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.ServiceDocument;
import com.vmware.xenon.common.ServiceDocumentDescription.PropertyIndexingOption;
import com.vmware.xenon.common.StatefulService;
import com.vmware.xenon.common.TaskState;
import com.vmware.xenon.common.TaskState.TaskStage;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.common.Utils;
import com.vmware.xenon.services.common.QueryTask;
import com.vmware.xenon.services.common.QueryTask.Query;
import com.vmware.xenon.services.common.QueryTask.Query.Occurance;
import com.vmware.xenon.services.common.QueryTask.QuerySpecification.QueryOption;
import com.vmware.xenon.services.common.QueryTask.QueryTerm.MatchType;

/**
 * Synchronize the ContainerVolumeStates with a list of volume names
 */
public class HostVolumeListDataCollection extends StatefulService {
    public static final String FACTORY_LINK = ManagementUriParts.HOST_VOLUME_LIST_DATA_COLLECTION;

    public static final String DEFAULT_HOST_VOLUME_LIST_DATA_COLLECTION_ID =
            "__default-list-data-collection";
    public static final String DEFAULT_HOST_VOLUME_LIST_DATA_COLLECTION_LINK = UriUtils
            .buildUriPath(FACTORY_LINK, DEFAULT_HOST_VOLUME_LIST_DATA_COLLECTION_ID);
    private static final long RETIRED_VOLUME_EXPIRE_PERIOD_HOURS = Long.getLong(
            "com.vmware.admiral.data.collection.retired.volume.expiration.hours", 5);

    private static final long DATA_COLLECTION_LOCK_TIMEOUT_MILLISECONDS = Long.getLong(
            "com.vmware.admiral.compute.container.volume.datacollection.lock.timeout.milliseconds",
            TimeUnit.MINUTES.toMillis(5));
    private static final Integer MAX_DATA_COLLECTION_FAILURES = Integer.getInteger(
            "com.vmware.admiral.compute.container.volume.max.datacollection.failures", 3);

    private static final int VOLUME_INSPECT_RETRY_COUNT = Integer.parseInt(System.getProperty(
            "com.vmware.admiral.compute.container.volume.inspect.retry.count", "3"));

    private static final int VOLUME_INSPECT_RETRY_INTERVAL_SECONDS = Integer.parseInt(System.getProperty(
            "com.vmware.admiral.compute.container.volume.inspect.retry.interval.seconds", "10"));

    public static class HostVolumeListDataCollectionState extends
            TaskServiceDocument<DefaultSubStage> {
        @Documentation(description = "The list of container host links.")
        @PropertyOptions(indexing = {
                PropertyIndexingOption.STORE_ONLY,
                PropertyIndexingOption.EXCLUDE_FROM_SIGNATURE })
        public Map<String, Long> containerHostLinks;
    }

    public static class VolumeListCallback extends ServiceTaskCallbackResponse {
        public String containerHostLink;
        public Map<String, ContainerVolumeState> volumesByName = new HashMap<>();
        public boolean unlockDataCollectionForHost;

        public void add(ContainerVolumeState volume) {
            AssertUtil.assertNotNull(volume.name, "volumeName");
            AssertUtil.assertNotNull(volume.driver, "volumeDriver");
            volumesByName.put(volume.name, volume);
        }
    }

    public static ServiceDocument buildDefaultStateInstance() {
        HostVolumeListDataCollectionState state = new HostVolumeListDataCollectionState();
        state.documentSelfLink = DEFAULT_HOST_VOLUME_LIST_DATA_COLLECTION_LINK;
        state.taskInfo = new TaskState();
        state.taskInfo.stage = TaskStage.STARTED;
        state.containerHostLinks = new HashMap<>();
        return state;
    }

    public HostVolumeListDataCollection() {
        super(HostVolumeListDataCollectionState.class);
        super.toggleOption(ServiceOption.PERSISTENCE, true);
        super.toggleOption(ServiceOption.REPLICATION, true);
        super.toggleOption(ServiceOption.OWNER_SELECTION, true);
        super.toggleOption(ServiceOption.IDEMPOTENT_POST, true);
    }

    @Override
    public void handlePost(Operation post) {
        if (!post.hasBody()) {
            post.fail(new IllegalArgumentException("body is required"));
            return;
        }

        HostVolumeListDataCollectionState initState = post
                .getBody(HostVolumeListDataCollectionState.class);
        if (initState.documentSelfLink == null
                || !initState.documentSelfLink
                        .endsWith(DEFAULT_HOST_VOLUME_LIST_DATA_COLLECTION_ID)) {
            post.fail(new LocalizableValidationException(
                    "Only one instance of list containers data collection can be started",
                    "compute.volumes.data-collection.single"));
            return;
        }

        post.setBody(initState).complete();
    }

    @Override
    public void handlePatch(Operation op) {
        VolumeListCallback body = op.getBody(VolumeListCallback.class);

        if (body.containerHostLink == null) {
            logFine("'containerHostLink' is required");
            op.setStatusCode(Operation.STATUS_CODE_NOT_MODIFIED);
            op.complete();
            return;
        }

        HostVolumeListDataCollectionState state = getState(op);
        if (body.unlockDataCollectionForHost) {
            // patch to mark that there is no active list volumes data collection for a given
            // host.
            state.containerHostLinks.remove(body.containerHostLink);
            op.complete();
            return;
        }

        AssertUtil.assertNotNull(body.volumesByName, "volumesByName");

        if (Logger.getLogger(this.getClass().getName()).isLoggable(Level.FINE)) {
            logFine("Host volume list callback invoked for host [%s] with volume names: %s",
                    body.containerHostLink, body.volumesByName.keySet().toString());
        }

        // the patch will succeed regardless of the synchronization process
        if (state.containerHostLinks.get(body.containerHostLink) != null &&
                Instant.now().isBefore(Instant.ofEpochMilli(
                        (state.containerHostLinks.get(body.containerHostLink))))) {
            op.setStatusCode(Operation.STATUS_CODE_NOT_MODIFIED);
            op.complete();
            return;// return since there is an active data collection for this host.
        } else {
            state.containerHostLinks.put(body.containerHostLink,
                    Instant.now().toEpochMilli() + DATA_COLLECTION_LOCK_TIMEOUT_MILLISECONDS);
            op.complete();
            // continue with the data collection.
        }

        List<ContainerVolumeState> volumeStates = new ArrayList<>();

        QueryTask queryTask = QueryUtil.buildQuery(ContainerVolumeState.class, true);

        // Clause to find all volumes for the given host.

        String parentLinksItemField = QueryTask.QuerySpecification
                .buildCollectionItemName(ContainerVolumeState.FIELD_NAME_PARENT_LINKS);
        QueryTask.Query parentsClause = new QueryTask.Query()
                .setTermPropertyName(parentLinksItemField)
                .setTermMatchValue(body.containerHostLink)
                .setTermMatchType(MatchType.TERM)
                .setOccurance(Occurance.SHOULD_OCCUR);

        // Clause to find all global (shared) volumes (that may already exist on different hosts).

        QueryTask.Query globalScopeClause = new QueryTask.Query()
                .setTermPropertyName(ContainerVolumeState.FIELD_NAME_SCOPE)
                .setTermMatchValue("global")
                .setTermMatchType(MatchType.TERM)
                .setOccurance(Occurance.SHOULD_OCCUR);

        // Intermediate query because of Xenon ?!

        Query intermediate = new QueryTask.Query().setOccurance(Occurance.MUST_OCCUR);
        intermediate.addBooleanClause(parentsClause);
        intermediate.addBooleanClause(globalScopeClause);

        queryTask.querySpec.query.addBooleanClause(intermediate);

        QueryUtil.addExpandOption(queryTask);
        QueryUtil.addBroadcastOption(queryTask);

        new ServiceDocumentQuery<>(getHost(), ContainerVolumeState.class)
                .query(queryTask,
                        (r) -> {
                            if (r.hasException()) {
                                logSevere("Failed to query for existing ContainerVolumeState"
                                                + " instances: %s",
                                        r.getException() instanceof CancellationException
                                                ? r.getException().getMessage()
                                                : Utils.toString(r.getException()));
                                unlockCurrentDataCollectionForHost(body.containerHostLink);
                            } else if (r.hasResult()) {
                                volumeStates.add(r.getResult());
                            } else {
                                AdapterRequest request = new AdapterRequest();
                                request.operationTypeId =
                                        ContainerHostOperationType.LIST_VOLUMES.id;
                                request.serviceTaskCallback = ServiceTaskCallback.createEmpty();
                                request.resourceReference = UriUtils.buildUri(getHost(),
                                        body.containerHostLink);
                                sendRequest(Operation
                                        .createPatch(this, ManagementUriParts.ADAPTER_DOCKER_HOST)
                                        .setBodyNoCloning(request)
                                        .addPragmaDirective(
                                                Operation.PRAGMA_DIRECTIVE_QUEUE_FOR_SERVICE_AVAILABILITY)
                                        .setCompletion(
                                                (o, ex) -> {
                                                    if (ex == null) {
                                                        VolumeListCallback callback = o
                                                                .getBody(VolumeListCallback.class);
                                                        updateContainerVolumeStates(callback,
                                                                volumeStates,
                                                                body.containerHostLink);
                                                    } else {
                                                        unlockCurrentDataCollectionForHost(
                                                                body.containerHostLink);
                                                    }
                                                }));
                            }
                        });
    }

    @Override
    public void handlePut(Operation put) {
        if (put.hasPragmaDirective(Operation.PRAGMA_DIRECTIVE_POST_TO_PUT)) {
            logFine("Ignoring converted PUT.");
            put.complete();
            return;
        }

        if (!checkForBody(put)) {
            return;
        }

        HostVolumeListDataCollectionState putBody = put
                .getBody(HostVolumeListDataCollectionState.class);

        this.setState(put, putBody);
        put.setBody(putBody).complete();
    }

    @Override
    public ServiceDocument getDocumentTemplate() {
        ServiceDocument template = super.getDocumentTemplate();
        com.vmware.photon.controller.model.ServiceUtils.setRetentionLimit(template);
        return template;
    }

    private void updateContainerVolumeStates(VolumeListCallback callback,
            List<ContainerVolumeState> volumeStates, String callbackHostLink) {

        for (ContainerVolumeState volumeState : volumeStates) {

            boolean isGlobal = "global".equals(volumeState.scope);

            // if volume inspect hasn't finished, skip current volume processing until next
            // data collection
            if (volumeState.driver == null) {
                logFine("ContainerVolumeState %s not discovered, skip handling volume",
                        volumeState.name);
                callback.volumesByName.remove(volumeState.name);
                continue;
            }

            // note: since volume scope is updated after the first volume inspection, including the
            // long VMDK volume name (@datastore) and power state (PROVISIONING to CONNECTED),
            // existing volumes states in provisioning power state cannot be part of this query
            // result. Worrying about a possible mismatch between VMDK long/short names is
            // unnecessary.

            ContainerVolumeState discoveredVolume = callback.volumesByName.get(volumeState.name);

            boolean existsInCallbackHost = discoveredVolume != null
                    && discoveredVolume.driver.equals(volumeState.driver);

            if (existsInCallbackHost) {
                if (volumeState.powerState != PowerState.CONNECTED) {
                    updateVolumePowerState(volumeState);
                }
                callback.volumesByName.remove(volumeState.name);
            }

            if (volumeState.parentLinks == null) {
                volumeState.parentLinks = new ArrayList<>();
            }

            if (!existsInCallbackHost) {
                if (!isGlobal) {
                    handleMissingContainerVolume(volumeState);
                } else {
                    if (volumeState.parentLinks.contains(callbackHostLink)) {
                        volumeState.parentLinks.remove(callbackHostLink);
                        handleUpdateParentLinks(volumeState);
                    } else if (volumeState.parentLinks.isEmpty()) {
                        handleMissingContainerVolume(volumeState);
                    }
                }
            } else {
                if (isGlobal && volumeState.originatingHostLink != null
                        && !volumeState.parentLinks.contains(callbackHostLink)) {
                    volumeState.parentLinks.add(callbackHostLink);
                    handleUpdateParentLinks(volumeState);
                }
            }
        }

        // finished removing existing ContainerVolumeState, now deal with remaining names
        List<ContainerVolumeState> volumesLeft = new ArrayList<>();

        Operation operation = Operation
                .createGet(this, callback.containerHostLink)
                .setCompletion(
                        (o, ex) -> {
                            if (ex != null) {
                                logSevere("Failure to retrieve host [%s]. Error: %s",
                                        callback.containerHostLink, Utils.toString(ex));
                                unlockCurrentDataCollectionForHost(callback.containerHostLink);
                                return;
                            }
                            ComputeState host = o.getBody(ComputeState.class);
                            List<String> group = host.tenantLinks;

                            for (ContainerVolumeState v : callback.volumesByName.values()) {
                                volumesLeft.add(
                                        buildVolumeState(host.documentSelfLink, group, v.name));
                            }

                            createDiscoveredContainerVolumes(
                                    volumesLeft,
                                    (e) -> unlockCurrentDataCollectionForHost(host.documentSelfLink)
                            );
                        });

        sendRequest(operation);
    }

    private ContainerVolumeState buildVolumeState(String containerHostLink, List<String> group,
            String name) {
        ContainerVolumeState volume = new ContainerVolumeState();
        volume.name = name;
        volume.external = true;
        volume.tenantLinks = group;
        volume.descriptionLink = String.format("%s-%s",
                ContainerVolumeDescriptionService.DISCOVERED_DESCRIPTION_LINK,
                UUID.randomUUID().toString());

        volume.originatingHostLink = containerHostLink;
        volume.parentLinks = new ArrayList<>(Arrays.asList(containerHostLink));
        volume.powerState = PowerState.CONNECTED;
        volume.adapterManagementReference = UriUtils.buildUri(
                ManagementUriParts.ADAPTER_DOCKER_VOLUME);

        return volume;
    }

    private void updateVolumePowerState(ContainerVolumeState volumeState) {
        ContainerVolumeState patchState = new ContainerVolumeState();
        patchState.powerState = PowerState.CONNECTED;

        sendRequest(Operation.createPatch(this, volumeState.documentSelfLink)
                .setBodyNoCloning(patchState)
                .setCompletion((o, e) -> {
                    if (e != null) {
                        logWarning("Could not update volume %s to state %s",
                                volumeState.documentSelfLink, PowerState.CONNECTED);
                    }
                }));

    }

    private void createDiscoveredContainerVolumes(List<ContainerVolumeState> volumeStates,
            Consumer<Throwable> callback) {
        if (volumeStates.isEmpty()) {
            callback.accept(null);
        } else {
            AtomicInteger counter = new AtomicInteger(volumeStates.size());
            for (ContainerVolumeState volumeState : volumeStates) {

                if (volumeState.name == null) {
                    logInfo("Name not set for volume: %s", volumeState.documentSelfLink);
                    if (counter.decrementAndGet() == 0) {
                        callback.accept(null);
                    }
                    continue;
                }

                // check again if the volume state already exists by id. This is because
                // the docker host could be added in a different project. This will result
                // in discovering the volumes created in the other project.
                String possibleVolumeSelfLink = UriUtils.buildUriPath(ContainerVolumeService
                        .FACTORY_LINK, volumeState.name);

                List<ContainerVolumeState> volumeStatesFound = new ArrayList<>();
                QueryTask volumeServicesQuery = QueryUtil.buildPropertyQuery(
                        ContainerVolumeState.class,
                        ContainerVolumeState.FIELD_NAME_SELF_LINK, possibleVolumeSelfLink);
                volumeServicesQuery.querySpec.options.add(QueryOption.INCLUDE_DELETED);
                new ServiceDocumentQuery<>(getHost(), ContainerVolumeState.class)
                        .query(volumeServicesQuery, (r) -> {
                            if (r.hasException()) {
                                logSevere("Failed to get volume %s : %s",
                                        volumeState.name, r.getException().getMessage());
                                callback.accept(r.getException());
                            } else if (r.hasResult()) {
                                if (r.getResult().documentUpdateTimeMicros < Utils.fromNowMicrosUtc(
                                        -MAINTENANCE_INTERVAL_MICROS / 2)) {
                                    volumeStatesFound.add(r.getResult());
                                }
                            } else {
                                if (volumeStatesFound.isEmpty()) {
                                    createDiscoveredContainerVolume(callback, counter,
                                            volumeState);
                                } else {
                                    if (counter.decrementAndGet() == 0) {
                                        callback.accept(null);
                                    }
                                }
                            }
                        });
            }
        }
    }

    private void createDiscoveredContainerVolume(Consumer<Throwable> callback,
            AtomicInteger counter, ContainerVolumeState volumeState) {

        logFine("Creating ContainerVolumeState for discovered volume: %s", volumeState.name);

        sendRequest(OperationUtil
                .createForcedPost(this, ContainerVolumeService.FACTORY_LINK)
                .setBodyNoCloning(volumeState)
                .setCompletion(
                        (o, ex) -> {
                            if (ex != null) {
                                logSevere("Failed to create ContainerVolumeState for discovered"
                                                + " volume (name=%s): %s",
                                        volumeState.name, ex.getMessage());
                                callback.accept(ex);
                                return;
                            }
                            logInfo("Created ContainerVolumeState for discovered volume: %s",
                                    volumeState.name);


                            ContainerVolumeState body = o.getBody(ContainerVolumeState.class);
                            createDiscoveredContainerVolumeDescription(body);
                            inspectVolumeWithRetry(body, VOLUME_INSPECT_RETRY_COUNT);

                            if (counter.decrementAndGet() == 0) {
                                callback.accept(null);
                            }
                        }));
    }

    private void createDiscoveredContainerVolumeDescription(ContainerVolumeState volumeState) {

        logFine("Creating ContainerVolumeDescription for discovered volume: %s", volumeState.name);

        ContainerVolumeDescription volumeDesc = VolumeUtil
                .createContainerVolumeDescription(volumeState);

        sendRequest(OperationUtil
                .createForcedPost(this, ContainerVolumeDescriptionService.FACTORY_LINK)
                .setBodyNoCloning(volumeDesc)
                .setCompletion(
                        (o, ex) -> {
                            if (ex != null) {
                                logSevere( "Failed to create ContainerVolumeDescription for"
                                                + " discovered volume (name=%s): %s",
                                        volumeState.name, ex.getMessage());
                            } else {
                                logInfo("Created ContainerVolumeDescription for discovered"
                                                + " volume: %s", volumeState.name);
                            }
                        }));
    }

    private void handleMissingContainerVolume(ContainerVolumeState volumeState) {
        Integer healthFailureCount = volumeState._healthFailureCount != null
                ? Integer.valueOf(volumeState._healthFailureCount + 1)
                : Integer.valueOf(1);

        if (MAX_DATA_COLLECTION_FAILURES.equals(healthFailureCount)) {
            // clean up transient volume states (these point to volumes that are auto-created by
            // docker upon container provisioning and are not not tracked by us; nevertheless, they
            // are auto-discovered and later deleted by docker during container removal requests)

            logInfo("Deleting volume with link [%s] after max failures to datacollect it reached.",
                    volumeState.documentSelfLink);

            Operation deleteOp = Operation.createDelete(this, volumeState.documentSelfLink)
                    .setCompletion((o, e) -> {
                        if (e != null) {
                            logWarning("Failed to delete volume state with link [%s]: [%s]",
                                    volumeState.documentSelfLink, Utils.toString(e));
                        }
                    });

            sendRequest(deleteOp);
            return;
        }

        // patch volume status to RETIRED
        ContainerVolumeState patchVolumeState = new ContainerVolumeState();
        patchVolumeState.powerState = PowerState.RETIRED;
        patchVolumeState._healthFailureCount = healthFailureCount;
        if (RETIRED_VOLUME_EXPIRE_PERIOD_HOURS >= 0) {
            patchVolumeState.documentExpirationTimeMicros = Utils.fromNowMicrosUtc(
                    TimeUnit.HOURS.toMicros(RETIRED_VOLUME_EXPIRE_PERIOD_HOURS));
        }

        sendRequest(Operation
                .createPatch(this, volumeState.documentSelfLink)
                .setBodyNoCloning(patchVolumeState)
                .setCompletion((o, ex) -> {
                    if (o.getStatusCode() == Operation.STATUS_CODE_NOT_FOUND) {
                        logFine("Volume %s not found to be marked as missing.",
                                volumeState.documentSelfLink);
                    } else if (ex != null) {
                        logWarning("Failed to mark volume %s as missing: %s",
                                volumeState.documentSelfLink, Utils.toString(ex));
                    } else {
                        logInfo("Marked volume as missing: %s (expiration=%d hours)",
                                volumeState.documentSelfLink, RETIRED_VOLUME_EXPIRE_PERIOD_HOURS);
                    }
                }));
    }

    private void unlockCurrentDataCollectionForHost(String containerHostLink) {
        VolumeListCallback body = new VolumeListCallback();
        body.containerHostLink = containerHostLink;
        body.unlockDataCollectionForHost = true;
        sendRequest(Operation.createPatch(getUri())
                .setBodyNoCloning(body)
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        logWarning("Self patch failed: %s",
                                ex instanceof CancellationException ? ex.getMessage()
                                        : Utils.toString(ex));
                    }
                }));
    }

    private void handleUpdateParentLinks(ContainerVolumeState volumeState) {
        ContainerVolumeState patchVolumeState = new ContainerVolumeState();
        patchVolumeState.parentLinks = volumeState.parentLinks;

        if ((volumeState.originatingHostLink != null) && !volumeState.parentLinks.isEmpty()
                && (!volumeState.parentLinks.contains(volumeState.originatingHostLink))) {
            // set another parent like the "owner" of the volume
            patchVolumeState.originatingHostLink = volumeState.parentLinks.get(0);
        }

        sendRequest(Operation
                .createPatch(this, volumeState.documentSelfLink)
                .setBodyNoCloning(patchVolumeState)
                .setCompletion((o, ex) -> {
                    if (o.getStatusCode() == Operation.STATUS_CODE_NOT_FOUND) {
                        logFine("Volume %s not found to be updated its parent links.",
                                volumeState.documentSelfLink);
                    } else if (ex != null) {
                        logWarning("Failed to update volume %s parent links: %s",
                                volumeState.documentSelfLink, Utils.toString(ex));
                    } else {
                        logInfo("Updated volume parent links: %s", volumeState.documentSelfLink);
                    }
                }));
    }

    private void inspectVolumeWithRetry(ContainerVolumeState volume, int retry) {
        AssertUtil.assertTrue(retry > 0, "Negative retry count.");

        AdapterRequest request = new AdapterRequest();
        request.resourceReference = UriUtils.buildPublicUri(getHost(), volume.documentSelfLink);
        request.operationTypeId = VolumeOperationType.INSPECT.id;
        request.serviceTaskCallback = ServiceTaskCallback.createEmpty();

        final int retriesRemaining = retry - 1;
        final int delaySeconds = (VOLUME_INSPECT_RETRY_COUNT - retriesRemaining) *
                VOLUME_INSPECT_RETRY_INTERVAL_SECONDS;

        sendRequest(Operation.createPatch(this, volume.adapterManagementReference.toString())
                .setBodyNoCloning(request)
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        logWarning("Error while inspect volume: %s. Reties left: %d. Error: %s",
                                volume.documentSelfLink, retriesRemaining, Utils.toString(ex));
                        if (retriesRemaining > 0) {
                            getHost().schedule(() ->
                                            inspectVolumeWithRetry(volume, retriesRemaining),
                                    delaySeconds, TimeUnit.SECONDS);
                        }
                    }
                }));
    }

}
