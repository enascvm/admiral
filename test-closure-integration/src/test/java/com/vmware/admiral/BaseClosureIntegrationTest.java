/*
 * Copyright (c) 2016 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import static com.vmware.admiral.BaseProvisioningOnCoreOsIT.RegistryType.V1_SSL_SECURE;
import static com.vmware.admiral.TestPropertiesUtil.getTestRequiredProp;

import java.io.IOException;
import java.net.URI;
import java.security.KeyManagementException;
import java.security.KeyStoreException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import com.google.gson.JsonArray;
import org.junit.Assert;

import com.vmware.admiral.closures.drivers.ContainerConfiguration;
import com.vmware.admiral.closures.drivers.DriverRegistry;
import com.vmware.admiral.closures.drivers.DriverRegistryImpl;
import com.vmware.admiral.closures.services.closure.Closure;
import com.vmware.admiral.closures.services.closure.ClosureFactoryService;
import com.vmware.admiral.closures.services.closuredescription.ClosureDescription;
import com.vmware.admiral.closures.services.closuredescription.ClosureDescriptionFactoryService;
import com.vmware.admiral.closures.services.images.DockerImage;
import com.vmware.admiral.closures.services.images.DockerImageFactoryService;
import com.vmware.admiral.closures.util.ClosureUtils;
import com.vmware.admiral.compute.ContainerHostService;
import com.vmware.admiral.compute.RegistryHostConfigService;
import com.vmware.admiral.service.common.RegistryService;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.ServiceClient;
import com.vmware.xenon.common.TaskState;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.common.Utils;

/**
 * Base of integration tests.
 */
public class BaseClosureIntegrationTest extends BaseProvisioningOnCoreOsIT {

    public static final int DOCKER_IMAGE_BUILD_TIMEOUT_SECONDS = 30 * 60;

    public final String DOCKER_REGISTRY_URL = getRegistryHostname(V1_SSL_SECURE);

    protected static final String TEST_WEB_SERVER_URL_PROP_NAME = "test.webserver.url";

    protected static DriverRegistry driverRegistry = new DriverRegistryImpl();

    private RegistryHostConfigService.RegistryHostSpec hostState;
    private RegistryService.RegistryState registryState;

    protected static String testWebserverUri;

    private URI helperUri;

    protected static void setupClosureEnv() throws Exception {
        try {
            testWebserverUri = getTestWebServerUrl();
            setupCoreOsHost(ContainerHostService.DockerAdapterType.API, false);
        } catch (Exception ex) {
            ex.printStackTrace();
            throw ex;
        }
    }

    @Override
    protected String getResourceDescriptionLink(boolean downloadImage, RegistryType registryType)
            throws Exception {
        return null;
    }

    protected void cleanResource(String targetLink, ServiceClient serviceClient) throws Exception {
        URI targetUri = URI.create(getBaseUrl() + buildServiceUri(targetLink));
        sendRequest(serviceClient, Operation.createDelete(targetUri));
    }

    protected SimpleHttpsClient.HttpResponse getResource(String targetLink) throws Exception {
        URI targetUri = URI.create(getBaseUrl() + buildServiceUri(targetLink));
        return SimpleHttpsClient
                .execute(SimpleHttpsClient.HttpMethod.GET, targetUri.toString());
    }

    protected Closure createClosure(ClosureDescription closureDescription,
            ServiceClient serviceClient)
            throws InterruptedException, ExecutionException, TimeoutException {
        Closure closureState = new Closure();
        closureState.descriptionLink = closureDescription.documentSelfLink;
        URI targetUri = URI.create(getBaseUrl()
                + buildServiceUri(ClosureFactoryService.FACTORY_LINK));
        Operation op = sendRequest(serviceClient,
                Operation.createPost(targetUri).setBody(closureState));
        return op.getBody(Closure.class);
    }

    protected ClosureDescription createClosureDescription(String taskDefPayload,
            ServiceClient serviceClient)
            throws InterruptedException, ExecutionException, TimeoutException {
        URI targetUri = URI.create(getBaseUrl()
                + buildServiceUri(ClosureDescriptionFactoryService.FACTORY_LINK));
        Operation op = sendRequest(serviceClient,
                Operation.createPost(targetUri).setBody(taskDefPayload));
        return op.getBody(ClosureDescription.class);
    }

    protected void executeClosure(Closure createdClosure, Closure closureRequest,
            ServiceClient serviceClient)
            throws
            InterruptedException, ExecutionException, TimeoutException {
        URI targetUri = URI.create(getBaseUrl() + buildServiceUri(createdClosure.documentSelfLink));
        Operation op = sendRequest(serviceClient,
                Operation.createPost(targetUri).setBody(closureRequest));
        Assert.assertNotNull(op);
    }

    protected Closure getClosure(String link, ServiceClient serviceClient)
            throws
            InterruptedException, ExecutionException, TimeoutException {
        URI targetUri = URI.create(getBaseUrl() + buildServiceUri(link));
        Operation op = sendRequest(serviceClient, Operation.createGet(targetUri));

        return op.getBody(Closure.class);
    }

    protected String waitForBuildCompletion(String imagePrefix,
            ClosureDescription closureDescription) throws Exception {
        String imageName = prepareImageName(imagePrefix, closureDescription);
        logger.info(
                "Build for docker execution image: " + imageName + " on host: " + dockerHostCompute
                        .documentSelfLink);
        String dockerBuildImageLink = createImageBuildRequestUri(imageName,
                dockerHostCompute.documentSelfLink);
        long startTime = System.currentTimeMillis();
        logger.info("Waiting for docker image build: " + dockerBuildImageLink);
        while (!isImageReady(getBaseUrl(), dockerBuildImageLink) && isTimeoutNotElapsed(startTime,
                DOCKER_IMAGE_BUILD_TIMEOUT_SECONDS)) {
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
        logger.info("Docker image " + imageName + " built on host: "
                + dockerHostCompute.documentSelfLink);

        return dockerBuildImageLink;
    }

    protected void verifyRunDuration(Closure closure) {
        Long duration = closure.endTimeMillis - closure.lastLeasedTimeMillis;
        assertTrue(String.format("Run duration is expected to be > 0, actual: %sms", duration),
                duration > 0);
    }

    protected void registerExternalDockerRegistry(ServiceClient serviceClient) throws Throwable {
        registryState = createRegistryState(DOCKER_REGISTRY_URL);

        hostState = new RegistryHostConfigService.RegistryHostSpec();
        hostState.hostState = registryState;
        hostState.acceptHostAddress = true;
        hostState.acceptCertificate = true;

        helperUri = UriUtils.buildUri(UriUtils.buildUri(getBaseUrl()), RegistryHostConfigService
                .SELF_LINK);

        Operation op = Operation
                .createPut(helperUri)
                .setBody(hostState)
                .setCompletion((o, e) -> {
                    if (e != null) {
                        fail("Unable to set insecure registry: " + e.getMessage());
                    }
                });

        sendRequest(serviceClient, op);
    }

    protected RegistryService.RegistryState createRegistryState(String repoUrl) {
        RegistryService.RegistryState registryState = new RegistryService.RegistryState();
        registryState.name = getClass().getName();
        registryState.address = repoUrl;
        registryState.endpointType = RegistryService.RegistryState.DOCKER_REGISTRY_ENDPOINT_TYPE;

        return registryState;
    }

    private boolean isImageReady(String serviceHostUri, String dockerBuildImageLink)
            throws Exception {
        SimpleHttpsClient.HttpResponse imageRequestResponse = SimpleHttpsClient.execute(
                SimpleHttpsClient.HttpMethod
                        .GET, serviceHostUri + dockerBuildImageLink, null);
        if (imageRequestResponse == null || imageRequestResponse.responseBody == null) {
            return false;
        }
        DockerImage imageRequest = Utils.fromJson(imageRequestResponse.responseBody,
                DockerImage.class);
        Assert.assertNotNull(imageRequest);

        if (TaskState.isFailed(imageRequest.taskInfo)
                || TaskState.isCancelled(imageRequest.taskInfo)) {
            throw new Exception("Unable to build docker execution image: " + dockerBuildImageLink);
        }

        return TaskState.isFinished(imageRequest.taskInfo);
    }

    private static String prepareImageName(String imagePrefix, ClosureDescription closureDesc)
            throws CertificateException, NoSuchAlgorithmException, KeyStoreException,
            KeyManagementException, IOException {
        String imageTag;
        ContainerConfiguration containerConfiguration = new ContainerConfiguration();
        containerConfiguration.dependencies = closureDesc.dependencies;
        if (!ClosureUtils.isEmpty(closureDesc.sourceURL)) {
            SimpleHttpsClient.HttpResponse resp = SimpleHttpsClient.execute(
                    SimpleHttpsClient.HttpMethod
                            .GET, closureDesc.sourceURL, null);

            String lastChanged = resp.headers.get("Last-Modified").get(0);
            String contentLenght = resp.headers.get("Content-Length").get(0);
            imageTag = ClosureUtils
                    .prepareImageTag(containerConfiguration, driverRegistry.getImageVersion
                                    (closureDesc.runtime), closureDesc
                                    .sourceURL, lastChanged,
                            contentLenght);
        } else {
            imageTag = ClosureUtils
                    .prepareImageTag(containerConfiguration, driverRegistry.getImageVersion
                            (closureDesc.runtime));
        }
        return imagePrefix + ":" + imageTag;
    }

    protected static String createImageBuildRequestUri(String imageName, String computeStateLink) {
        String imageBuildRequestId = ClosureUtils.calculateHash(new String[] { imageName, "/",
                computeStateLink });

        return UriUtils.buildUriPath(DockerImageFactoryService.FACTORY_LINK, imageBuildRequestId);
    }

    protected boolean isTimeoutNotElapsed(long startTime, int timeout) {
        return System.currentTimeMillis() - startTime <= TimeUnit.SECONDS.toMillis(timeout);
    }

    protected void waitForTaskState(String link, TaskState.TaskStage state,
            ServiceClient serviceClient, int timeout)
            throws Exception {
        Closure fetchedClosure = getClosure(link, serviceClient);
        long startTime = System.currentTimeMillis();
        while (state != fetchedClosure.state
                && !isFinished(fetchedClosure.state)) {
            verifyTimeout(timeout, fetchedClosure, startTime);

            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            fetchedClosure = getClosure(link, serviceClient);
        }

        logger.info("Closure state: %s link: %s", fetchedClosure.state,
                fetchedClosure.documentSelfLink);
    }

    private void verifyTimeout(int timeout, Closure fetchedClosure, long startTime) {
        boolean isNotTimeouted = isTimeoutNotElapsed(startTime, timeout);
        assertTrue("Timeout of " + timeout + " seconds elapsed! Test considered as FAILED! "
                + "Closure state: " + fetchedClosure.state + " Closure link: " +
                fetchedClosure.documentSelfLink, isNotTimeouted);
    }

    private boolean isFinished(TaskState.TaskStage state) {
        return state == TaskState.TaskStage.FINISHED
                || state == TaskState.TaskStage.FAILED
                || state == TaskState.TaskStage.CANCELLED;

    }

    protected void waitForTaskState(String link, TaskState.TaskStage state,
            ServiceClient serviceClient) throws Exception {
        waitForTaskState(link, state, serviceClient, 300);
    }

    protected void verifyJsonArrayInts(Object[] javaArray, JsonArray jsArray) {
        assertEquals(javaArray.length, jsArray.size());
        for (int i = 0; i < javaArray.length; i++) {
            assertEquals(javaArray[i], jsArray.get(i).getAsInt());
        }
    }

    protected void verifyJsonArrayStrings(Object[] javaArray, JsonArray jsArray) {
        assertEquals(javaArray.length, jsArray.size());
        for (int i = 0; i < javaArray.length; i++) {
            assertEquals(javaArray[i], jsArray.get(i).getAsString());
        }
    }

    protected void verifyJsonArrayBooleans(Object[] javaArray, JsonArray jsArray) {
        assertEquals(javaArray.length, jsArray.size());
        for (int i = 0; i < javaArray.length; i++) {
            assertEquals(javaArray[i], jsArray.get(i).getAsBoolean());
        }
    }

    protected static String getTestWebServerUrl() {
        return getTestRequiredProp(TEST_WEB_SERVER_URL_PROP_NAME);
    }

}
