/*
 * Copyright (c) 2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral.adapter.pks.service;

import java.net.URI;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

import com.vmware.admiral.adapter.common.AdapterRequest;
import com.vmware.admiral.adapter.pks.PKSContext;
import com.vmware.admiral.adapter.pks.PKSOperationType;
import com.vmware.admiral.adapter.pks.PKSRemoteClientService;
import com.vmware.admiral.common.DeploymentProfileConfig;
import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.common.util.DeferredUtils;
import com.vmware.admiral.common.util.ServerX509TrustManager;
import com.vmware.admiral.compute.pks.PKSEndpointService;
import com.vmware.photon.controller.model.resources.ComputeService.ComputeState;
import com.vmware.photon.controller.model.security.util.AuthCredentialsType;
import com.vmware.photon.controller.model.security.util.EncryptionUtils;
import com.vmware.xenon.common.DeferredResult;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.StatelessService;
import com.vmware.xenon.common.Utils;
import com.vmware.xenon.services.common.AuthCredentialsService.AuthCredentialsServiceState;

public class PKSAdapterService extends StatelessService {

    public static final String SELF_LINK = ManagementUriParts.ADAPTER_PKS;

    private static final long MAINTENANCE_INTERVAL_MICROS = Long.getLong(
            "dcp.management.docker.adapter.periodic.maintenance.period.micros",
            TimeUnit.SECONDS.toMicros(10));

    private static final Cache<String, PKSContext> pksContextCache = CacheBuilder
            .newBuilder()
            .expireAfterWrite(12, TimeUnit.HOURS)
            .build();

    private static class RequestContext extends AdapterRequest {
        public Operation operation;
        public List<String> tenantLinks;
        public PKSEndpointService.Endpoint endpoint;
        public ComputeState computeState;
    }

    public PKSAdapterService() {
        super();
        super.toggleOption(ServiceOption.PERIODIC_MAINTENANCE, true);
        super.toggleOption(ServiceOption.INSTRUMENTATION, true);
        super.setMaintenanceIntervalMicros(MAINTENANCE_INTERVAL_MICROS);
    }

    @Override
    public void handleStart(Operation startPost) {
        super.handleStart(startPost);

        // initialize pks client
        initClient();
    }

    @Override
    public void handleStop(Operation op) {
        getClient().stop();
        op.complete();
    }

    @Override
    public void handlePeriodicMaintenance(Operation op) {
        if (getProcessingStage() != ProcessingStage.AVAILABLE) {
            logFine("Skipping maintenance since service is not available: %s ", getUri());
            op.complete();
            return;
        }

        if (DeploymentProfileConfig.getInstance().isTest()) {
            logInfo("Skipping scheduled maintenance in test mode: %s", getUri());
            op.complete();
            return;
        }

        logFine("Performing maintenance for: %s", getUri());

        getClient().handleMaintenance(Operation.createPost(op.getUri()));

        op.complete();
    }

    @Override
    public void handlePatch(Operation op) {
        RequestContext ctx = op.getBody(RequestContext.class);
        ctx.validate();
        ctx.operation = op;

        getEndpoint(ctx.resourceReference)
                .thenAccept(e -> ctx.endpoint = e)
                .thenCompose(aVoid -> processOperation(ctx))
                .exceptionally(t -> {
                    op.fail(t);
                    DeferredUtils.logException(t, Level.SEVERE,
                            e -> String.format("Error: %s", Utils.toString(e)), getClass());
                    return null;
                });
    }

    private DeferredResult<Void> processOperation(RequestContext ctx) {
        PKSOperationType operationType = PKSOperationType.instanceById(ctx.operationTypeId);
        logInfo("Received [%s] for endpoint [%s]",
                PKSOperationType.extractDisplayName(operationType.id), ctx.endpoint.name);

        switch (operationType) {
        case LIST_CLUSTERS:
            return pksListClusters(ctx);
        case GET_CLUSTER:
            return pksGetCluster(ctx);
        case CREATE_CLUSTER:
            //TODO implementation
            break;
        case DELETE_CLUSTER:
            //TODO implementation
            break;
        default:
            break;
        }

        DeferredResult<Void> result = new DeferredResult<>();
        result.fail(new IllegalArgumentException("unsupported operation"));
        return result;
    }

    private DeferredResult<Void> pksListClusters(RequestContext ctx) {
        return getPKSContext(ctx.endpoint)
                .thenCompose(pksContext -> getClient().getClusters(pksContext))
                .thenAccept(pksClusters -> ctx.operation.setBodyNoCloning(pksClusters).complete())
                .exceptionally(t -> {
                    throw DeferredUtils.logErrorAndThrow(t,
                            e -> String.format("Error getting clusters for %s, reason: %s",
                                    ctx.endpoint.documentSelfLink, e.getMessage()),
                            getClass());
                });
    }

    private DeferredResult<Void> pksGetCluster(RequestContext ctx) {
        if (ctx.computeState == null || ctx.computeState.id == null) {
            //TODO proper localizable exception
            DeferredResult<Void> result = new DeferredResult<>();
            result.fail(new IllegalArgumentException("empty compute state"));
            return result;
        }
        return getPKSContext(ctx.endpoint)
                .thenCompose(pksContext -> getClient().getCluster(pksContext, ctx.computeState.id))
                .thenAccept(pksCluster -> ctx.operation.setBodyNoCloning(pksCluster).complete())
                .exceptionally(t -> {
                    throw DeferredUtils.logErrorAndThrow(t,
                            e -> String.format("Error getting cluster %s for %s, reason: %s",
                                    ctx.computeState.id, ctx.endpoint.documentSelfLink,
                                    e.getMessage()),
                            getClass());
                });
    }

    private DeferredResult<PKSEndpointService.Endpoint> getEndpoint(URI uri) {
        Operation op = Operation.createGet(this, uri.getPath());
        return sendWithDeferredResult(op, PKSEndpointService.Endpoint.class)
                .exceptionally(ex -> {
                    throw DeferredUtils.logErrorAndThrow(ex,
                            e -> String.format("Unable to get PKS endpoint state %s, reason: %s",
                                    uri.getPath(), e.getMessage()),
                            getClass());
                });
    }

    private DeferredResult<AuthCredentialsServiceState> getCredentials(String selfLink) {
        Operation op = Operation.createGet(this, selfLink);
        return sendWithDeferredResult(op, AuthCredentialsServiceState.class)
                .exceptionally(ex -> {
                    throw DeferredUtils.logErrorAndThrow(ex,
                            e -> String.format("Unable to get PKS endpoint credentials state %s,"
                                    + " reason: %s", selfLink, e.getMessage()),
                            getClass());
                });
    }

    private DeferredResult<PKSContext> getPKSContext(PKSEndpointService.Endpoint endpoint) {
        //TODO implement retriable logic
        DeferredResult<PKSContext> result = new DeferredResult<>();
        try {
            result.complete(pksContextCache.get(endpoint.documentSelfLink,
                    () -> createNewPKSContext(endpoint)));
        } catch (ExecutionException e) {
            result.fail(e);
        }
        return result;
    }

    private PKSContext createNewPKSContext(PKSEndpointService.Endpoint endpoint)
            throws ExecutionException, InterruptedException {
        return getCredentials(endpoint.authCredentialsLink)
                .thenCompose(authCredentials -> login(endpoint, authCredentials))
                .exceptionally(t -> {
                    throw DeferredUtils.logErrorAndThrow(t, Throwable::getMessage, getClass());
                })
                .toCompletionStage()
                .toCompletableFuture()
                .get();
    }

    private DeferredResult<PKSContext> login(PKSEndpointService.Endpoint endpoint,
            AuthCredentialsServiceState authCredentials) {
        AuthCredentialsType authCredentialsType = AuthCredentialsType.valueOf(authCredentials.type);
        if (AuthCredentialsType.Password == authCredentialsType) {
            String username = authCredentials.userEmail;
            String password = EncryptionUtils.decrypt(authCredentials.privateKey);

            //TODO run this in separate thread
            return getClient()
                    .login(endpoint.uaaEndpoint, username, password)
                    .thenApply(uaaTokenResponse -> PKSContext.create(endpoint, uaaTokenResponse));
        }

        throw new IllegalArgumentException("Credential type " + authCredentialsType.name()
                + " is not supported");
    }

    private void initClient() {
        ServerX509TrustManager trustManager = ServerX509TrustManager.create(getHost());

        try {
            new PKSRemoteClientService(trustManager, getHost());
        } catch (IllegalStateException ignored) {
            // ignore already initialized exception
        }
    }

    private PKSRemoteClientService getClient() {
        return PKSRemoteClientService.getInstance();
    }

}
