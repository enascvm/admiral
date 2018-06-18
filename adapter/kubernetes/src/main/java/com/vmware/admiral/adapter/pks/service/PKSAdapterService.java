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

import static com.vmware.admiral.adapter.pks.PKSConstants.CLUSTER_NAME_PROP_NAME;
import static com.vmware.admiral.adapter.pks.PKSConstants.VALIDATE_CONNECTION;

import java.util.HashMap;
import java.util.LinkedList;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.logging.Level;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

import com.vmware.admiral.adapter.common.AdapterRequest;
import com.vmware.admiral.adapter.pks.PKSConstants;
import com.vmware.admiral.adapter.pks.PKSContext;
import com.vmware.admiral.adapter.pks.PKSException;
import com.vmware.admiral.adapter.pks.PKSOperationType;
import com.vmware.admiral.adapter.pks.PKSRemoteClientService;
import com.vmware.admiral.common.DeploymentProfileConfig;
import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.common.task.RetriableTask;
import com.vmware.admiral.common.task.RetriableTaskBuilder;
import com.vmware.admiral.common.util.DeferredUtils;
import com.vmware.admiral.common.util.PropertyUtils;
import com.vmware.admiral.common.util.ServerX509TrustManager;
import com.vmware.admiral.compute.pks.PKSEndpointService.Endpoint;
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

    private static final long REMOVE_TOKEN_BEFORE_EXPIRE_MILLIS = 2 * MAINTENANCE_INTERVAL_MICROS;

    private static class RequestContext {
        public Operation operation;
        public AdapterRequest request;
        public Endpoint endpoint;
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
    public void handlePatch(Operation op) {
        RequestContext ctx = new RequestContext();
        ctx.request = getRequest(op);
        ctx.operation = op;

        getEndpoint(ctx)
                .thenAccept(e -> ctx.endpoint = e)
                .thenCompose(aVoid -> processOperationWithRetry(ctx))
                .exceptionally(t -> {
                    if (t instanceof CompletionException) {
                        t = t.getCause();
                    }
                    op.fail(t);
                    DeferredUtils.logException(t, Level.SEVERE,
                            e -> String.format("Error: %s", Utils.toString(e)), getClass());
                    return null;
                });
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

        try {
            getClient().handleMaintenance(Operation.createPost(op.getUri()));
            expireCachedTokens();
        } catch (Exception ignored) {
        }

        op.complete();
    }

    private DeferredResult<Void> processOperationWithRetry(RequestContext ctx) {
        PKSOperationType ot = PKSOperationType.instanceById(ctx.request.operationTypeId);
        logInfo("Received [%s] for endpoint [%s]", ot.getDisplayName(), ctx.endpoint.name);

        DeferredResult<Void> result = new DeferredResult<>();
        new RetriableTaskBuilder<Void>("process-pks-operation-" + ctx.operation.getId())
                .withMaximumRetries(1)
                .withRetryDelays(5L)
                .withRetryDelaysTimeUnit(TimeUnit.SECONDS)
                .withServiceHost(getHost())
                .withTaskFunction(processOperationTask(ctx, ot))
                .execute()
                .whenComplete((ignored, t) -> {
                    if (t != null) {
                        result.fail(t);
                    } else {
                        result.complete(null);
                    }
                });

        return result;
    }

    private Function<RetriableTask<Void>, DeferredResult<Void>> processOperationTask(
            RequestContext ctx, PKSOperationType operationType) {
        return (task) -> {
            DeferredResult<Void> result = new DeferredResult<>();
            try {
                result = initDeferredOperation(operationType, ctx);
                if (result.toCompletionStage().toCompletableFuture().isCompletedExceptionally()) {
                    return result;
                }

                result.exceptionally(t -> {
                    // if status code is 401 (UNAUTHORIZED) invalidate the token and retry,
                    // else prevent retries
                    if (t instanceof PKSException) {
                        PKSException p = (PKSException) t;
                        if (p.getErrorCode() == Operation.STATUS_CODE_UNAUTHORIZED) {
                            logInfo("Operation for %s returns code 401, invalidate token and retry",
                                    ctx.endpoint.documentSelfLink);
                            if (ctx.endpoint.documentSelfLink != null) {
                                pksContextCache.invalidate(ctx.endpoint.documentSelfLink);
                            }
                        } else {
                            task.preventRetries();
                        }
                    } else {
                        task.preventRetries();
                    }
                    throw DeferredUtils.wrap(t);
                });

            } catch (Exception e) {
                result.fail(e);
            }
            return result;
        };
    }

    private DeferredResult<Void> initDeferredOperation(PKSOperationType operationType,
            RequestContext ctx) {
        DeferredResult<Void> result = new DeferredResult<>();
        switch (operationType) {
        case LIST_CLUSTERS:
            result = pksListClusters(ctx);
            break;
        case GET_CLUSTER:
            result = pksGetCluster(ctx);
            break;
        case CREATE_USER:
            result = pksCreateUser(ctx);
            break;
        /*
        case CREATE_CLUSTER:
            //TODO implementation
            break;
        case DELETE_CLUSTER:
            //TODO implementation
            break;
        */
        case LIST_PLANS:
            result = pksListPlans(ctx);
            break;
        default:
            result.fail(new IllegalArgumentException("unsupported operation"));
        }
        return result;
    }

    private DeferredResult<Void> pksCreateUser(RequestContext ctx) {
        String cluster = PropertyUtils
                .getPropertyString(ctx.request.customProperties, CLUSTER_NAME_PROP_NAME)
                .orElse(null);

        if (cluster == null) {
            //TODO proper localizable exception
            DeferredResult<Void> result = new DeferredResult<>();
            result.fail(new IllegalArgumentException("cluster name is required"));
            return result;
        }

        return getPKSContext(ctx.endpoint)
                .thenCompose(pksContext -> getClient().createUser(pksContext, cluster))
                .thenAccept(authInfo -> ctx.operation.setBodyNoCloning(authInfo).complete());
    }

    private DeferredResult<Void> pksListClusters(RequestContext ctx) {
        return getPKSContext(ctx.endpoint)
                .thenCompose(pksContext -> getClient().getClusters(pksContext))
                .thenAccept(pksClusters -> ctx.operation.setBodyNoCloning(pksClusters).complete());
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
                .thenAccept(pksCluster -> ctx.operation.setBodyNoCloning(pksCluster).complete());
    }

    private DeferredResult<Void> pksListPlans(RequestContext ctx) {
        return getPKSContext(ctx.endpoint)
                .thenCompose(pksContext -> getClient().getPlans(pksContext))
                .thenAccept(pksPlans -> ctx.operation.setBodyNoCloning(pksPlans).complete());
    }

    private DeferredResult<Endpoint> getEndpoint(RequestContext ctx) {
        if (ctx.request.customProperties.containsKey(VALIDATE_CONNECTION)) {
            return buildFakeEndpoint(ctx);
        }

        String path = ctx.request.resourceReference.getPath();
        Operation op = Operation.createGet(this, path);
        return sendWithDeferredResult(op, Endpoint.class)
                .exceptionally(ex -> {
                    throw DeferredUtils.logErrorAndThrow(ex,
                            e -> String.format("Unable to get PKS endpoint state %s, reason: %s",
                                    path, e.getMessage()),
                            getClass());
                });
    }

    private DeferredResult<AuthCredentialsServiceState> getCredentials(String selfLink) {
        if (selfLink == null || selfLink.isEmpty()) {
            return DeferredResult.completed(null);
        }
        Operation op = Operation.createGet(this, selfLink);
        return sendWithDeferredResult(op, AuthCredentialsServiceState.class)
                .exceptionally(ex -> {
                    throw DeferredUtils.logErrorAndThrow(ex,
                            e -> String.format("Unable to get PKS endpoint credentials state %s,"
                                    + " reason: %s", selfLink, e.getMessage()),
                            getClass());
                });
    }

    private DeferredResult<PKSContext> getPKSContext(Endpoint endpoint) {
        DeferredResult<PKSContext> result = new DeferredResult<>();
        new RetriableTaskBuilder<PKSContext>("get-token-from-" + endpoint.uaaEndpoint)
                .withMaximumRetries(1)
                .withRetryDelays(15L)
                .withRetryDelaysTimeUnit(TimeUnit.SECONDS)
                .withServiceHost(getHost())
                .withTaskFunction(retriableLoginTask(endpoint))
                .execute()
                .whenComplete((pksContext, t) -> {
                    if (t != null) {
                        DeferredUtils.logException(t, Level.SEVERE,
                                e -> String.format("Cannot get token from %s, reason: %s",
                                        endpoint.uaaEndpoint, e.getMessage()), getClass());
                        result.fail(t);
                    } else {
                        result.complete(pksContext);
                    }
                });
        return result;
    }

    private Function<RetriableTask<PKSContext>, DeferredResult<PKSContext>> retriableLoginTask(
            Endpoint endpoint) {

        return (task) -> {
            DeferredResult<PKSContext> result = new DeferredResult<>();
            try {
                if (endpoint.customProperties != null
                        && endpoint.customProperties.get(VALIDATE_CONNECTION) != null) {
                    result.complete(createNewPKSContext(endpoint));
                } else {
                    result.complete(pksContextCache.get(endpoint.documentSelfLink,
                            () -> createNewPKSContext(endpoint)));
                }
            } catch (Exception e) {
                result.fail(e);
            }
            return result;
        };
    }

    private PKSContext createNewPKSContext(Endpoint endpoint)
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

    /**
     * Login in PKS and returns PKS context instance with token.
     */
    private DeferredResult<PKSContext> login(Endpoint endpoint,
            AuthCredentialsServiceState authCredentials) {
        if (authCredentials == null) {
            return DeferredResult.completed(PKSContext.create(endpoint, null));
        }
        AuthCredentialsType authCredentialsType = AuthCredentialsType.valueOf(authCredentials.type);
        if (AuthCredentialsType.Password == authCredentialsType) {
            String username = authCredentials.userEmail;
            String password = EncryptionUtils.decrypt(authCredentials.privateKey);

            return getClient()
                    .login(endpoint.uaaEndpoint, username, password)
                    .thenApply(uaaTokenResponse -> PKSContext.create(endpoint, uaaTokenResponse));
        }

        throw new IllegalArgumentException("Credential type " + authCredentialsType.name()
                + " is not supported");
    }

    private AdapterRequest getRequest(Operation op) {
        AdapterRequest request = op.getBody(AdapterRequest.class);
        request.validate();
        if (request.customProperties == null) {
            request.customProperties = new HashMap<>(2);
        }
        return request;
    }

    /**
     * Construct fake {@link Endpoint} state used only to validate connection.
     */
    private DeferredResult<Endpoint> buildFakeEndpoint(RequestContext ctx) {
        Endpoint e = new Endpoint();
        e.customProperties = new HashMap<>(2);
        e.customProperties.put(VALIDATE_CONNECTION, "true");
        e.name = "test-connection";
        e.uaaEndpoint = ctx.request.customProperties.get(Endpoint.FIELD_NAME_UAA_ENDPOINT);
        e.apiEndpoint = ctx.request.customProperties.get(Endpoint.FIELD_NAME_API_ENDPOINT);
        e.authCredentialsLink = ctx.request.customProperties.get(PKSConstants.CREDENTIALS_LINK);
        ctx.endpoint = e;
        DeferredResult<Endpoint> result = new DeferredResult<>();
        result.complete(e);
        return result;
    }

    /**
     * Expire cached tokens.
     */
    private void expireCachedTokens() {
        ConcurrentMap<String, PKSContext> map = pksContextCache.asMap();
        long currentTime = System.currentTimeMillis();
        LinkedList<String> expiredKeys = new LinkedList<>();
        map.forEach((key, pksContext) -> {
            if (currentTime - pksContext.expireMillisTime > REMOVE_TOKEN_BEFORE_EXPIRE_MILLIS) {
                expiredKeys.add(key);
                logInfo("Removing expired token for %s", key);
            }
        });
        expiredKeys.forEach(pksContextCache::invalidate);
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
