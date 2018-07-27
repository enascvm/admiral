/*
 * Copyright (c) 2016-2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral.compute;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.lang.reflect.Method;
import java.net.ProtocolException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

import io.netty.channel.ConnectTimeoutException;

import org.junit.Before;
import org.junit.Test;


import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.common.util.QueryUtil;
import com.vmware.admiral.common.util.ServiceDocumentQuery;
import com.vmware.admiral.compute.ContainerHostService.ContainerHostSpec;
import com.vmware.admiral.compute.container.ComputeBaseTest;
import com.vmware.admiral.compute.container.ContainerDescriptionService.ContainerDescription;
import com.vmware.admiral.compute.container.HostPortProfileService;
import com.vmware.admiral.service.test.MockDockerHostAdapterService;
import com.vmware.photon.controller.model.resources.ComputeDescriptionService;
import com.vmware.photon.controller.model.resources.ComputeService;
import com.vmware.photon.controller.model.resources.ComputeService.ComputeState;
import com.vmware.photon.controller.model.resources.ComputeService.PowerState;
import com.vmware.photon.controller.model.resources.ResourcePoolService;
import com.vmware.photon.controller.model.resources.ResourcePoolService.ResourcePoolState;
import com.vmware.xenon.common.LocalizableValidationException;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.common.Utils;
import com.vmware.xenon.common.test.TestContext;
import com.vmware.xenon.services.common.QueryTask;

public class ContainerHostServiceTest extends ComputeBaseTest {
    public static final String COMPUTE_ADDRESS = "somehost";
    public static final String FIRST_COMPUTE_DESC_ID = "test-first-host-compute-desc-id";
    public static final String SECOND_COMPUTE_DESC_ID = "test-second-host-compute-desc-id";
    public static final String RESOURCE_POOL_ID = "test-host-resource-pool";
    public static final String ADAPTER_DOCKER_TYPE_ID = "API";

    public static final String TENANTS_IDENTIFIER = "/tenants/";
    public static final String GROUP_IDENTIFIER = "/groups/";
    public static final String USER_IDENTIFIER = "/users/";

    private static final String FIRST_TENANT_ID = TENANTS_IDENTIFIER + "tenant1";
    private static final String SECOND_TENANT_ID = TENANTS_IDENTIFIER + "tenant2";
    private static final String FIRST_SUB_TENANT_ID = GROUP_IDENTIFIER + "subtenant1";
    private static final String SECOND_SUB_TENANT_ID = GROUP_IDENTIFIER + "subtenant2";
    private static final String FIRST_USER_ID = USER_IDENTIFIER + "user1";
    private static final String SECOND_USER_ID = USER_IDENTIFIER + "user2";

    private MockDockerHostAdapterService dockerAdapterService;

    private List<String> tenantLinks;

    @Before
    public void setUp() throws Throwable {
        waitForServiceAvailability(ContainerHostService.SELF_LINK);
        waitForServiceAvailability(ComputeService.FACTORY_LINK);
        waitForServiceAvailability(ResourcePoolService.FACTORY_LINK);

        dockerAdapterService = new MockDockerHostAdapterService();
        host.startService(Operation.createPost(UriUtils.buildUri(host,
                MockDockerHostAdapterService.class)), dockerAdapterService);
        waitForServiceAvailability(MockDockerHostAdapterService.SELF_LINK);

        createPlacementZone();

        tenantLinks = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_SUB_TENANT_ID,
                FIRST_USER_ID);
    }

    private ResourcePoolState createPlacementZone() throws Throwable {
        return doPost(createResourcePoolState(), ResourcePoolService.FACTORY_LINK);
    }

    // there is already created host with tenant links "[/tenants/tenant1]"
    // and we won't be able to add a host with tenant links "[/tenants/tenant1]"
    @Test
    public void testPutFromSameTenant() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinks, SECOND_COMPUTE_DESC_ID);

        try {
            createContainerHostSpec(hostSpec);
            fail("Should've thrown IllegalArgumentException - "
                    + ContainerHostService.CONTAINER_HOST_ALREADY_EXISTS_MESSAGE);
        } catch (LocalizableValidationException e) {
            assertNotNull(e);
            assertEquals(ContainerHostService.CONTAINER_HOST_ALREADY_EXISTS_MESSAGE,
                    e.getMessage());
        }
    }

    @Test
    public void testPutAcceptCertificates() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        List<String> tenantLinksWithDifferentTenant = Arrays.asList(
                SECOND_TENANT_ID);
        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithDifferentTenant,
                SECOND_COMPUTE_DESC_ID);
        hostSpec.acceptHostAddress = true;
        hostSpec.acceptCertificate = true;

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    @Test
    public void testPutEmptyHostType() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinks, SECOND_COMPUTE_DESC_ID);
        hostSpec.hostState.customProperties.put(ContainerHostService.CONTAINER_HOST_TYPE_PROP_NAME, "invalid");
        String errorMessage = String.format(
                ContainerHostUtil.CONTAINER_HOST_TYPE_NOT_SUPPORTED_MESSAGE_FORMAT, "invalid");
        try {
            createContainerHostSpec(hostSpec);
            fail("Should've thrown LocalizableValidationException - " + errorMessage);
        } catch (LocalizableValidationException e) {
            assertEquals(errorMessage, e.getMessage());
        }
    }

    @Test(expected = IllegalArgumentException.class)
    public void testPutWithEmptyBody() throws Throwable {
        createContainerHostSpec(null);
    }

    @Test
    public void testUpdateFromSameTenant() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        cs = doPost(cs, ComputeService.FACTORY_LINK);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinks, FIRST_COMPUTE_DESC_ID);
        hostSpec.hostState.documentSelfLink = cs.documentSelfLink;
        String updatedHostName = "updated name";
        hostSpec.hostState.name = updatedHostName;
        hostSpec.isUpdateOperation = true;

        createContainerHostSpec(hostSpec);
        ComputeState updatedHost = assertComputeStateExists(hostSpec);
        assertEquals(updatedHost.name, updatedHostName);
    }

    @Test
    public void testExerciseExceptionOnSendAdapterRequest() throws Throwable {
        // 1. Shutdown host-docker-service
        TestContext ctx = testCreate(1);
        Operation deleteOp = Operation.createDelete(
                UriUtils.buildUri(host, ManagementUriParts.ADAPTER_DOCKER_HOST))
                .addPragmaDirective(Operation.PRAGMA_DIRECTIVE_NO_INDEX_UPDATE)
                .setReplicationDisabled(true)
                .setCompletion(ctx.getCompletion())
                .setReferer(host.getUri());
        host.send(deleteOp);
        ctx.await();

        // 2. Create Container Host Spec.
        List<String> tenantLinks = Arrays.asList(FIRST_TENANT_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinks, FIRST_COMPUTE_DESC_ID);

        // 3. Try to create Container Host with Adapter Docker Host service stopped.
        try {
            createContainerHostSpec(hostSpec);
            fail("Should have thrown an exception since the service is stopped.");
        } catch (LocalizableValidationException e) {
            assertNotNull(e);
        }
    }

    // there is already created host with tenant links "[/tenants/tenant1]"
    // and we will be able to add a host with tenant links "[/tenants/tenant2]"
    @Test
    public void testPutFromDifferentTenant() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        List<String> tenantLinksWithDifferentTenant = Arrays.asList(
                SECOND_TENANT_ID);
        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithDifferentTenant,
                SECOND_COMPUTE_DESC_ID);

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    // there is already created host with tenant links "[/tenants/tenant1, /groups/subtenant1]"
    // and we won't be able to add a host with tenant links "[/tenants/tenant1, /groups/subtenant1]"
    @Test
    public void testPutFromSameTenantSameGroup() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_SUB_TENANT_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinks, SECOND_COMPUTE_DESC_ID);

        try {
            createContainerHostSpec(hostSpec);
            fail("Should've thrown IllegalArgumentException - "
                    + ContainerHostService.CONTAINER_HOST_ALREADY_EXISTS_MESSAGE);
        } catch (LocalizableValidationException e) {
            assertNotNull(e);
            assertEquals(ContainerHostService.CONTAINER_HOST_ALREADY_EXISTS_MESSAGE,
                    e.getMessage());
        }
    }

    // there is already created host with tenant links "[/tenants/tenant1, /groups/subtenant1]"
    // and we will be able to add a host with tenant links "[/tenants/tenant1, /groups/subtenant2]"
    @Test
    public void testPutFromSameTenantDifferentGroup() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_SUB_TENANT_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        List<String> tenantLinksWithDifferentGroup = Arrays.asList(
                FIRST_TENANT_ID,
                SECOND_SUB_TENANT_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithDifferentGroup,
                SECOND_COMPUTE_DESC_ID);

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    // there is already created host with tenant links "[/tenants/tenant1, /users/user1]"
    // and we won't be able to add a host with tenant links "[/tenants/tenant1, /users/user1]"
    @Test
    public void testPutFromSameTenantSameUser() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_USER_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinks, SECOND_COMPUTE_DESC_ID);

        try {
            createContainerHostSpec(hostSpec);
            fail("Should've thrown IllegalArgumentException - "
                    + ContainerHostService.CONTAINER_HOST_ALREADY_EXISTS_MESSAGE);
        } catch (LocalizableValidationException e) {
            assertNotNull(e);
            assertEquals(ContainerHostService.CONTAINER_HOST_ALREADY_EXISTS_MESSAGE,
                    e.getMessage());
        }
    }

    // there is already created host with tenant links "[/tenants/tenant1, /users/user1]"
    // and we will be able to add a host with tenant links "[/tenants/tenant1, /users/user2]"
    @Test
    public void testPutFromSameTenantDifferentUsers() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_USER_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        List<String> tenantLinksWithDifferentUser = Arrays.asList(
                FIRST_TENANT_ID,
                SECOND_USER_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithDifferentUser,
                SECOND_COMPUTE_DESC_ID);

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    // there is already created host with tenant links "[/tenants/tenant1, /users/user1]"
    // and we will be able to add a host with tenant links "[/tenants/tenant2, /users/user1]"
    @Test
    public void testPutFromDifferentTenantSameUsers() throws Throwable {
        List<String> tenantLinks = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_USER_ID);

        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        List<String> tenantLinksWithDifferentGroup = Arrays.asList(
                SECOND_TENANT_ID,
                FIRST_USER_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithDifferentGroup,
                SECOND_COMPUTE_DESC_ID);

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    // there is already created host with tenant links "[/tenants/tenant1, /groups/subtenant1,
    // /user/user1]"
    // and we will be able to add a host with tenant links "[/tenants/tenant1, /groups/subtenant1,
    // /user/user2]"
    @Test
    public void testPutFromSameTenantSameGroupDifferentUser() throws Throwable {
        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);


        List<String> tenantLinksWithSecondTenant = Arrays.asList(
                FIRST_TENANT_ID,
                FIRST_SUB_TENANT_ID,
                SECOND_USER_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithSecondTenant,
                SECOND_COMPUTE_DESC_ID);

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    // there is already created host with tenant links "[/tenants/tenant1, /groups/subtenant1,
    // /user/user1]"
    // and we will be able to add a host with tenant links "[/tenants/tenant1, /groups/subtenant2,
    // /user/user1]"
    @Test
    public void testPutFromSameTenantDifferentGroupSameUser() throws Throwable {
        ComputeState cs = createComputeHost(tenantLinks, FIRST_COMPUTE_DESC_ID);
        doPost(cs, ComputeService.FACTORY_LINK);

        List<String> tenantLinksWithSecondTenant = Arrays.asList(
                FIRST_TENANT_ID,
                SECOND_SUB_TENANT_ID,
                FIRST_USER_ID);

        ContainerHostSpec hostSpec = createContainerHostSpec(tenantLinksWithSecondTenant,
                SECOND_COMPUTE_DESC_ID);

        createContainerHostSpec(hostSpec);

        assertComputeStateExists(hostSpec);
    }

    @Test
    public void testToReadableErrorMessage() throws Throwable {
        ContainerHostService service = new ContainerHostService();
        Method m = service.getClass().getDeclaredMethod("toReadableErrorMessage", Throwable.class,
                Operation.class);
        m.setAccessible(true);

        Exception e = new Exception();
        String result = (String) m.invoke(service, e, null);
        assertNotNull(result);
        assertTrue(result.contains("Unexpected error:"));

        e = new io.netty.handler.codec.DecoderException("Received fatal alert: bad_certificate");
        result = (String) m.invoke(service, e, null);
        assertNotNull(result);
        assertTrue(result.contains("Check login credentials"));

        e = new IllegalStateException("Socket channel closed:");
        result = (String) m.invoke(service, e, null);
        assertNotNull(result);
        assertTrue(result.contains("Check login credentials"));

        e = new Exception(new ConnectTimeoutException());
        result = (String) m.invoke(service, e, null);
        assertNotNull(result);
        assertTrue(result.contains("Connection timeout"));

        e = new Exception(new ProtocolException());
        result = (String) m.invoke(service, e, null);
        assertNotNull(result);
        assertTrue(result.contains("Protocol exception"));

        e = new IllegalArgumentException();
        result = (String) m.invoke(service, e, null);
        assertNotNull(result);
        assertTrue(result.contains("Illegal argument exception:"));
    }

    static ResourcePoolState createResourcePoolState() {

        ResourcePoolState resourcePoolState = new ResourcePoolState();
        resourcePoolState.id = RESOURCE_POOL_ID;
        resourcePoolState.name = resourcePoolState.id;
        resourcePoolState.documentSelfLink = UriUtils.buildUriPath(ResourcePoolService.FACTORY_LINK,
                resourcePoolState.id);
        return resourcePoolState;
    }

    static ComputeState createComputeHost(List<String> tenantLinks, String computeDescriptionId)
            throws Throwable {
        ComputeState cs = new ComputeState();
        cs.id = UUID.randomUUID().toString();
        cs.primaryMAC = UUID.randomUUID().toString();
        cs.address = COMPUTE_ADDRESS;
        cs.powerState = PowerState.ON;
        cs.descriptionLink = UriUtils.buildUriPath(ComputeDescriptionService.FACTORY_LINK,
                computeDescriptionId);
        cs.resourcePoolLink = UriUtils.buildUriPath(ResourcePoolService.FACTORY_LINK,
                RESOURCE_POOL_ID);
        cs.adapterManagementReference = URI.create("http://localhost:8081");
        cs.customProperties = new HashMap<>();
        cs.customProperties.put(ContainerHostService.HOST_DOCKER_ADAPTER_TYPE_PROP_NAME,
                ADAPTER_DOCKER_TYPE_ID);
        cs.customProperties.put(ComputeConstants.DOCKER_URI_PROP_NAME,
                ContainerDescription.getDockerHostUri(cs).toString());

        cs.tenantLinks = new ArrayList<>(tenantLinks);

        return cs;
    }

    static ContainerHostSpec createContainerHostSpec(List<String> tenantLinks,
            String computeDescriptionId) throws Throwable {
        ContainerHostSpec ch = new ContainerHostSpec();
        ch.hostState = createComputeHost(tenantLinks, computeDescriptionId);

        return ch;
    }

    private void createContainerHostSpec(ContainerHostSpec hostSpec) {
        Operation getCompositeDesc = Operation.createPut(
                UriUtils.buildUri(host, ContainerHostService.SELF_LINK))
                .setBody(hostSpec)
                .setCompletion(
                        (o, e) -> {
                            if (e != null) {
                                host.log("Exception while processing the container host: %s.",
                                        Utils.toString(e));
                                host.failIteration(e);
                                return;
                            } else {
                                host.completeIteration();
                            }
                        });
        host.testStart(1);
        host.send(getCompositeDesc);
        host.testWait();
    }

    private ComputeState assertComputeStateExists(ContainerHostSpec hostSpec) {
        QueryTask queryTask = QueryUtil.buildPropertyQuery(ComputeState.class,
                ComputeState.FIELD_NAME_DESCRIPTION_LINK, hostSpec.hostState.descriptionLink);
        QueryUtil.addExpandOption(queryTask);
        List<ComputeState> computeStates = new ArrayList<>();
        host.testStart(1);
        new ServiceDocumentQuery<>(host, ComputeState.class)
                .query(queryTask,
                        (r) -> {
                            if (r.hasException()) {
                                host.log("Exception while getting the compute state.");
                                host.failIteration(r.getException());
                            } else if (r.hasResult()) {
                                computeStates.add(r.getResult());
                            } else {
                                if (computeStates.isEmpty()) {
                                    host.log("No compute state with description link %s",
                                            hostSpec.hostState.descriptionLink);
                                    host.failIteration(r.getException());
                                } else {
                                    host.completeIteration();
                                }
                            }
                        });
        host.testWait();
        assertHostPortProfileStateExists(computeStates.get(0).documentSelfLink);
        return computeStates.get(0);
    }

    private void assertHostPortProfileStateExists(String computeStateLink) {
        QueryTask queryTask = QueryUtil.buildPropertyQuery(
                HostPortProfileService.HostPortProfileState.class,
                HostPortProfileService.HostPortProfileState.FIELD_HOST_LINK,
                computeStateLink);

        host.testStart(1);
        List<HostPortProfileService.HostPortProfileState> profiles = new ArrayList<>();
        new ServiceDocumentQuery<>(host, HostPortProfileService.HostPortProfileState.class)
                .query(queryTask,
                        (r) -> {
                            if (r.hasException()) {
                                host.log("Exception while getting the host port profile state.");
                                host.failIteration(r.getException());
                            } else if (r.hasResult()) {
                                profiles.add(r.getResult());
                                host.completeIteration();
                            } else {
                                if (profiles.size() != 1) {
                                    host.log("Expected 1 host port profile state, found [%s].",
                                            profiles.size());
                                    host.failIteration(r.getException());
                                } else {
                                    host.completeIteration();
                                }
                            }
                        });
        host.testWait();
    }
}
