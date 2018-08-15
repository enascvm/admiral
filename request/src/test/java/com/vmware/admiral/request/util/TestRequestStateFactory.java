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

package com.vmware.admiral.request.util;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.vmware.admiral.adapter.docker.util.DockerPortMapping;
import com.vmware.admiral.common.test.CommonTestStateFactory;
import com.vmware.admiral.compute.ComputeConstants;
import com.vmware.admiral.compute.ContainerHostUtil;
import com.vmware.admiral.compute.ResourceType;
import com.vmware.admiral.compute.container.CompositeDescriptionService.CompositeDescription;
import com.vmware.admiral.compute.container.ContainerDescriptionService;
import com.vmware.admiral.compute.container.ContainerDescriptionService.ContainerDescription;
import com.vmware.admiral.compute.container.ContainerService.ContainerState;
import com.vmware.admiral.compute.container.GroupResourcePlacementService.GroupResourcePlacementState;
import com.vmware.admiral.compute.container.PortBinding;
import com.vmware.admiral.compute.container.loadbalancer.ContainerLoadBalancerBackendDescription;
import com.vmware.admiral.compute.container.loadbalancer.ContainerLoadBalancerDescriptionService.ContainerLoadBalancerDescription;
import com.vmware.admiral.compute.container.loadbalancer.ContainerLoadBalancerFrontendDescription;
import com.vmware.admiral.compute.container.loadbalancer.ContainerLoadBalancerHealthConfig;
import com.vmware.admiral.compute.container.loadbalancer.ContainerLoadBalancerService
        .ContainerLoadBalancerState;
import com.vmware.admiral.compute.container.network.ContainerNetworkDescriptionService.ContainerNetworkDescription;
import com.vmware.admiral.compute.container.network.ContainerNetworkService.ContainerNetworkState;
import com.vmware.admiral.compute.container.volume.ContainerVolumeDescriptionService.ContainerVolumeDescription;
import com.vmware.admiral.compute.container.volume.ContainerVolumeService.ContainerVolumeState;
import com.vmware.admiral.compute.pks.PKSEndpointService.Endpoint;
import com.vmware.admiral.compute.pks.PKSEndpointService.Endpoint.PlanSet;
import com.vmware.admiral.request.RequestBrokerService.RequestBrokerState;
import com.vmware.photon.controller.model.ComputeProperties;
import com.vmware.photon.controller.model.resources.ComputeDescriptionService;
import com.vmware.photon.controller.model.resources.ComputeDescriptionService.ComputeDescription;
import com.vmware.photon.controller.model.resources.ComputeDescriptionService.ComputeDescription.ComputeType;
import com.vmware.photon.controller.model.resources.ComputeService;
import com.vmware.photon.controller.model.resources.ComputeService.ComputeState;
import com.vmware.photon.controller.model.resources.ComputeService.PowerState;
import com.vmware.photon.controller.model.resources.ResourcePoolService;
import com.vmware.photon.controller.model.resources.ResourcePoolService.ResourcePoolState;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.services.common.AuthCredentialsService;

public class TestRequestStateFactory extends CommonTestStateFactory {
    public static final String DEFAULT_PKS_ENDPOINT_NAME = "pks-endpoint";
    public static final String DEFAULT_PKS_ENDPOINT_API_ADDRESS = "https://localhost:9000";
    public static final String DEFAULT_PKS_ENDPOINT_UAA_ADDRESS = "https://localhost:9001";

    public static final String COMPUTE_DESC_ID = "test-compute-desc-id";
    public static final String COMPUTE_ADDRESS = "somehost";
    public static final String COMPOSITE_DESC_PARENT_LINK = "test-parent-desc-link";
    public static final String CONTAINER_DESC_LINK_NAME = "dcp-test-docker-desc";
    public static final String CONTAINER_DESC_IMAGE = "dcp-test:latest";
    public static final String CONTAINER_VOLUME_DRIVER = "flocker";
    public static final String CONTAINER_DESC_LINK = UriUtils.buildUriPath(
            ContainerDescriptionService.FACTORY_LINK, CONTAINER_DESC_LINK_NAME);
    public static final URI CONTAINER_IMAGE_REF = URI
            .create("https://enatai-jenkins.eng.vmware.com/job/docker-dcp-test/lastSuccessfulBuild/artifact/docker-dcp-test/dcp-test:latest.tgz");
    public static final String RESOURCE_POOL_ID = "test-docker-host-resource-pool";
    public static final String DOCKER_COMPUTE_DESC_ID = "test-docker-host-compute-desc-id";

    public static final String TENANT_NAME = "admiral";
    public static final String GROUP_NAME_DEVELOPMENT = "Development";
    public static final String GROUP_NAME_FINANCE = "Finance";
    public static final String USER_NAME = "fritz";

    public static final String TENANT_LINK_TEMPLATE = "/tenants/%s";
    public static final String TENANT_LINK_WITH_GROUP_TEMPLATE = "/tenants/%s/groups/%s";
    public static final String USER_LINK_TEMPLATE = "/users/%s";

    public static final String MOCK_COMPUTE_HOST_SERVICE_SELF_LINK = "/mock-boot-service";

    public static CompositeDescription createCompositeDescription(boolean isCloned) {
        CompositeDescription desc = new CompositeDescription();
        desc.name = "composite-admiral-test";
        desc.descriptionLinks = new ArrayList<>();

        if (isCloned) {
            desc.parentDescriptionLink = COMPOSITE_DESC_PARENT_LINK;
        }
        return desc;
    }

    public static CompositeDescription createCompositeDescription() {
        return createCompositeDescription(false);
    }

    public static ContainerDescription createContainerDescriptionWithPortBindingsHostPortSet() {
        ContainerDescription containerDesc = createContainerDescription("admiral-test");
        containerDesc.portBindings = Arrays.stream(new String[] {
                "5000:5000",
                "127.0.0.1::20080",
                "127.0.0.1:20080:80",
                "1234:1234/tcp" })
                .map((s) -> PortBinding.fromDockerPortMapping(DockerPortMapping.fromString(s)))
                .collect(Collectors.toList())
                .toArray(new PortBinding[0]);
        return containerDesc;
    }

    public static ContainerDescription createContainerDescription() {
        return createContainerDescription("admiral-test");
    }

    public static ContainerDescription createContainerDescription(String name, boolean isCloned,
            boolean exposePorts) {
        ContainerDescription containerDesc = new ContainerDescription();
        containerDesc.documentSelfLink = CONTAINER_DESC_LINK_NAME;
        containerDesc.name = name;
        containerDesc.tenantLinks = getTenantLinks();
        containerDesc.image = CONTAINER_DESC_IMAGE;
        containerDesc.imageReference = CONTAINER_IMAGE_REF;
        containerDesc.command = new String[] { "/opt/dcp/bin/dcp-test.sh" };
        containerDesc.memoryLimit = ContainerDescriptionService.getContainerMinMemoryLimit();
        containerDesc.memorySwapLimit = 0L;
        containerDesc.cpuShares = 5;

        if (exposePorts) {
            containerDesc.portBindings = Arrays.stream(new String[] {
                    "5000",
                    "127.0.0.1::20080",
                    "127.0.0.1::80",
                    "1234/tcp" })
                    .map((s) -> PortBinding.fromDockerPortMapping(DockerPortMapping.fromString(s)))
                    .collect(Collectors.toList())
                    .toArray(new PortBinding[0]);
        }

        containerDesc.dns = new String[] { "0.0.0.0" };
        containerDesc.env = new String[] {
                "ENV_VAR=value",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/go/bin"
                        +
                        ":/go/bin" };
        containerDesc.extraHosts = new String[] { "test-hostname:ip" };
        containerDesc.command = new String[] { "/usr/lib/postgresql/9.3/bin/postgres" };
        containerDesc.entryPoint = new String[] { "./dockerui" };
        containerDesc.volumes = new String[] { "/var/run/docker.sock:/var/run/docker.sock" };
        containerDesc.volumeDriver = CONTAINER_VOLUME_DRIVER;
        // containerDesc.volumesFrom = new String[] { "parent", "other:ro" };
        containerDesc.workingDir = "/container";
        // containerDesc.links = new String[] { "name:alias" };
        containerDesc.capAdd = new String[] { "NET_ADMIN" };
        containerDesc.device = new String[] { "/dev/sdc:/dev/xvdc:rwm" };
        // containerDesc.serviceLinks = new String[] { "mydep:alias" };
        containerDesc.customProperties = new HashMap<>(1);
        containerDesc.customProperties.put("propKey string", "customPropertyValue string");

        if (isCloned) {
            containerDesc.parentDescriptionLink = COMPOSITE_DESC_PARENT_LINK;
        }

        return containerDesc;
    }

    public static ContainerDescription createContainerDescription(String name) {
        return createContainerDescription(name, false, true);
    }

    public static ContainerNetworkDescription createContainerNetworkDescription(String name) {
        ContainerNetworkDescription desc = new ContainerNetworkDescription();
        desc.documentSelfLink = "test-network-" + name;
        desc.name = name;
        desc.tenantLinks = getTenantLinks();
        desc.customProperties = new HashMap<>();
        return desc;
    }

    public static ContainerLoadBalancerDescription createContainerLoadBalancerDescription(String
            name) {
        ContainerLoadBalancerDescription desc = new ContainerLoadBalancerDescription();
        desc.documentSelfLink = "test-container-lb-" + name;
        desc.name = name;
        desc.tenantLinks = getTenantLinks();
        desc.customProperties = new HashMap<>();
        desc.frontends = new ArrayList<>();
        ContainerLoadBalancerFrontendDescription frontend = new ContainerLoadBalancerFrontendDescription();
        frontend.port = 80;
        frontend.backends = new ArrayList<>();
        ContainerLoadBalancerBackendDescription backend = new ContainerLoadBalancerBackendDescription();
        backend.service = "wp";
        backend.port = 90;
        desc.links = new String[] {"wp"};
        frontend.backends.add(backend);
        frontend.healthConfig = new ContainerLoadBalancerHealthConfig();
        frontend.healthConfig.port = 80;
        frontend.healthConfig.protocol = "http";
        frontend.healthConfig.path = "/test";
        desc.frontends.add(frontend);
        desc.tenantLinks = getTenantLinks();
        return desc;
    }

    public static ContainerLoadBalancerState createContainerLoadBalancerState(String name) {
        ContainerLoadBalancerState state = new ContainerLoadBalancerState();
        state.name = name;
        state.tenantLinks = getTenantLinks();
        state.customProperties = new HashMap<>();
        state.frontends = new ArrayList<>();
        state.descriptionLink = "lb-desc";
        ContainerLoadBalancerFrontendDescription frontend = new ContainerLoadBalancerFrontendDescription();
        frontend.port = 80;
        frontend.backends = new ArrayList<>();
        ContainerLoadBalancerBackendDescription backend = new ContainerLoadBalancerBackendDescription();
        backend.service = "wp";
        backend.port = 90;
        state.links = new String[] {"wp"};
        frontend.backends.add(backend);
        frontend.healthConfig = new ContainerLoadBalancerHealthConfig();
        frontend.healthConfig.port = 80;
        frontend.healthConfig.protocol = "http";
        frontend.healthConfig.path = "/test";
        state.frontends.add(frontend);
        state.tenantLinks = getTenantLinks();
        return state;
    }

    public static List<String> getTenantLinks() {
        return createTenantLinks(TENANT_NAME);
    }

    public static ContainerVolumeDescription createContainerVolumeDescription(String name) {
        ContainerVolumeDescription desc = new ContainerVolumeDescription();
        desc.documentSelfLink = "test-volume-" + name;
        desc.name = name;
        desc.driver = "local";
        desc.tenantLinks = getTenantLinks();
        desc.customProperties = new HashMap<>(1);
        desc.customProperties.put("volume propKey string", "volume customPropertyValue string");
        return desc;
    }

    public static ResourcePoolState createResourcePool() {
        return createResourcePool(RESOURCE_POOL_ID, null);
    }

    public static ResourcePoolState createResourcePool(String poolId, String endpointLink) {
        ResourcePoolState poolState = new ResourcePoolState();
        poolState.name = poolId;
        poolState.id = poolState.name;
        poolState.documentSelfLink = poolState.id;
        poolState.maxCpuCount = 1600L;
        poolState.minCpuCount = 16L;
        poolState.minMemoryBytes = 1024L * 1024L * 1024L * 46L;
        poolState.maxMemoryBytes = poolState.minMemoryBytes * 2;
        poolState.minDiskCapacityBytes = poolState.maxDiskCapacityBytes = 1024L * 1024L * 1024L
                * 1024L;
        poolState.tenantLinks = createTenantLinks(TENANT_NAME);
        poolState.customProperties = new HashMap<>(3);
        poolState.customProperties.put(ComputeConstants.ENDPOINT_AUTH_CREDENTIALS_PROP_NAME,
                CommonTestStateFactory.AUTH_CREDENTIALS_ID);
        if (endpointLink != null) {
            poolState.customProperties.put(ComputeProperties.ENDPOINT_LINK_PROP_NAME, endpointLink);
        }
        return poolState;
    }

    public static Endpoint createPksEndpoint(String projectLink, String planName) {
        return createPksEndpoint(DEFAULT_PKS_ENDPOINT_NAME, projectLink, planName);
    }

    public static Endpoint createPksEndpoint(String name, String projectLink, String planName) {
        PlanSet planSet = new PlanSet();
        planSet.plans = Collections.singleton(planName);
        return createPksEndpoint(
                name,
                DEFAULT_PKS_ENDPOINT_API_ADDRESS,
                DEFAULT_PKS_ENDPOINT_UAA_ADDRESS,
                Collections.singletonList(projectLink),
                Collections.singletonMap(projectLink, planSet));
    }

    public static Endpoint createPksEndpoint(String name, String apiEndpoint, String uaaEndpoint,
            List<String> tenantLinks, Map<String, PlanSet> planAssignments) {
        Endpoint endpoint = new Endpoint();
        endpoint.name = name;
        endpoint.apiEndpoint = apiEndpoint;
        endpoint.uaaEndpoint = uaaEndpoint;
        endpoint.planAssignments = planAssignments;
        endpoint.tenantLinks = tenantLinks;
        return endpoint;
    }

    public static RequestBrokerState createRequestState() {
        return createRequestState(ResourceType.CONTAINER_TYPE.getName(), CONTAINER_DESC_LINK);
    }

    public static RequestBrokerState createComputeRequestState() {
        return createRequestState(ResourceType.COMPUTE_TYPE.getName(), COMPUTE_DESC_ID);
    }

    public static RequestBrokerState createPKSClusterRequestState(
            Map<String, String> customProperties) {
        return createRequestState(ResourceType.PKS_CLUSTER_TYPE.getName(), null, null,
                customProperties);
    }

    public static RequestBrokerState createRequestState(String resourceType,
            String resourceDescriptionLink) {
        return createRequestState(resourceType, resourceDescriptionLink, null, new HashMap<>());
    }

    public static RequestBrokerState createRequestState(String resourceType,
            String resourceDescriptionLink, String operation,
            Map<String, String> customProperties) {
        RequestBrokerState request = new RequestBrokerState();
        request.resourceType = resourceType;
        request.resourceDescriptionLink = resourceDescriptionLink;
        request.tenantLinks = createTenantLinks(TENANT_NAME);
        request.operation = operation;
        request.customProperties = customProperties;
        return request;
    }

    public static GroupResourcePlacementState createGroupResourcePlacementState() {
        return createGroupResourcePlacementState(ResourceType.CONTAINER_TYPE);
    }

    public static GroupResourcePlacementState createGroupResourcePlacementState(
            ResourceType resourceType) {
        return createGroupResourcePlacementState(resourceType, "test-reservation");
    }

    public static GroupResourcePlacementState createGroupResourcePlacementState(
            ResourceType resourceType, String name) {
        GroupResourcePlacementState rsrvState = new GroupResourcePlacementState();
        rsrvState.resourcePoolLink = UriUtils.buildUriPath(ResourcePoolService.FACTORY_LINK,
                RESOURCE_POOL_ID);
        rsrvState.tenantLinks = createTenantLinks(TENANT_NAME);
        rsrvState.name = name;
        rsrvState.maxNumberInstances = 20;
        rsrvState.memoryLimit = 0L;
        rsrvState.cpuShares = 3;
        rsrvState.resourceType = resourceType.getName();
        return rsrvState;
    }

    public static ComputeDescription createDockerHostDescription() {
        ComputeDescription hostDescription = new ComputeDescription();

        // create compute host descriptions first, then link them in the compute host state
        hostDescription.name = UUID.randomUUID().toString();
        hostDescription.environmentName = ComputeDescription.ENVIRONMENT_NAME_ON_PREMISE;
        hostDescription.id = UUID.randomUUID().toString();
        hostDescription.supportedChildren = new ArrayList<>(
                Arrays.asList(ComputeType.DOCKER_CONTAINER.toString()));
        hostDescription.documentSelfLink = hostDescription.id;
        hostDescription.authCredentialsLink = UriUtils.buildUriPath(
                AuthCredentialsService.FACTORY_LINK,
                CommonTestStateFactory.AUTH_CREDENTIALS_ID);
        hostDescription.instanceType = "small";
        hostDescription.tenantLinks = createTenantLinks(TENANT_NAME);
        hostDescription.customProperties = new HashMap<>();
        hostDescription.customProperties.put(
                ComputeConstants.CUSTOM_PROP_IMAGE_ID_NAME, "coreos");

        return hostDescription;
    }

    public static ComputeState createDockerComputeHost() {
        ComputeState cs = new ComputeState();
        cs.id = DOCKER_COMPUTE_ID;
        cs.primaryMAC = UUID.randomUUID().toString();
        cs.address = COMPUTE_ADDRESS; // this will be used for ssh to access the host
        cs.powerState = PowerState.ON;
        cs.name = UUID.randomUUID().toString();
        cs.descriptionLink = UriUtils.buildUriPath(ComputeDescriptionService.FACTORY_LINK,
                DOCKER_COMPUTE_DESC_ID);
        cs.resourcePoolLink = UriUtils.buildUriPath(ResourcePoolService.FACTORY_LINK,
                RESOURCE_POOL_ID);
        cs.adapterManagementReference = null;
        cs.customProperties = new HashMap<>();
        cs.customProperties.put(ComputeConstants.HOST_AUTH_CREDENTIALS_PROP_NAME,
                UriUtils.buildUriPath(
                        AuthCredentialsService.FACTORY_LINK, AUTH_CREDENTIALS_ID));
        // This property is used for checking if the host is VCH.
        // Forcing the __Driver prop with some value, in order to install the system container.
        cs.customProperties.put(ContainerHostUtil.PROPERTY_NAME_DRIVER,
                "overlay");
        return cs;
    }

    public static ContainerState createContainer() {
        ContainerState cont = new ContainerState();
        cont.parentLink = UriUtils.buildUriPath(ComputeService.FACTORY_LINK, DOCKER_COMPUTE_ID);
        cont.descriptionLink = UUID.randomUUID().toString();
        cont.address = COMPUTE_ADDRESS;
        cont.powerState = com.vmware.admiral.compute.container.ContainerService.ContainerState.PowerState.RUNNING;
        cont.customProperties = new HashMap<>();

        return cont;
    }

    public static ContainerNetworkState createNetwork(String name) {
        ContainerNetworkState net = new ContainerNetworkState();
        net.name = name;
        net.parentLinks = new ArrayList<>(Arrays.asList(
                UriUtils.buildUriPath(ComputeService.FACTORY_LINK, DOCKER_COMPUTE_ID)));

        return net;
    }

    public static ContainerVolumeState createVolume(String name) {
        ContainerVolumeState volume = new ContainerVolumeState();
        volume.name = name;
        String parentLink = UriUtils.buildUriPath(ComputeService.FACTORY_LINK, DOCKER_COMPUTE_ID);
        volume.originatingHostLink = parentLink;
        volume.parentLinks = new ArrayList<>(Arrays.asList(parentLink));

        return volume;
    }

    public static List<String> createTenantLinks(String tenant) {

        return createTenantLinks(tenant, null);
    }

    public static List<String> createTenantLinks(String tenant, String subTenant) {

        if (subTenant == null) {
            return new ArrayList<>(
                    Arrays.asList(String.format(TENANT_LINK_TEMPLATE, tenant)));
        }

        return new ArrayList<>(
                Arrays.asList(String.format(TENANT_LINK_TEMPLATE, tenant),
                        String.format(TENANT_LINK_WITH_GROUP_TEMPLATE, tenant, subTenant)));
    }

    public static List<String> createTenantLinks(String tenant, String subTenant, String user) {
        List<String> tenantLinks = new ArrayList<>(3);
        if (tenant != null) {
            tenantLinks.add(String.format(TENANT_LINK_TEMPLATE, tenant));
        }
        if (subTenant != null) {
            tenantLinks.add(String.format(TENANT_LINK_WITH_GROUP_TEMPLATE, tenant, subTenant));
        }
        if (user != null) {
            tenantLinks.add(String.format(USER_LINK_TEMPLATE, user));
        }

        return tenantLinks;
    }
}
