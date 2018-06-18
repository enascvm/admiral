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

package com.vmware.admiral.image.service;

import static com.vmware.admiral.adapter.registry.service.RegistryAdapterService.SEARCH_QUERY_PROP_NAME;
import static com.vmware.admiral.common.util.ServiceUtils.addServiceRequestRoute;
import static com.vmware.admiral.service.common.RegistryService.DEFAULT_INSTANCE_LINK;

import java.net.URI;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.logging.Level;

import com.vmware.admiral.adapter.common.AdapterRequest;
import com.vmware.admiral.adapter.common.ImageOperationType;
import com.vmware.admiral.adapter.docker.util.DockerImage;
import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.common.util.AssertUtil;
import com.vmware.admiral.common.util.OperationUtil;
import com.vmware.admiral.common.util.RegistryUtil;
import com.vmware.admiral.host.HostInitRegistryAdapterServiceConfig;
import com.vmware.admiral.service.common.MultiTenantDocument;
import com.vmware.admiral.service.common.ServiceTaskCallback;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.ServiceDocument;
import com.vmware.xenon.common.StatelessService;
import com.vmware.xenon.common.UriUtils;

/**
 * Lists tags for given container image
 */
public class ContainerImageTagsService extends StatelessService {
    public static final String SELF_LINK = ManagementUriParts.IMAGE_TAGS;

    public static final String TENANT_LINKS_PARAM_NAME = MultiTenantDocument.FIELD_NAME_TENANT_LINKS;
    public static final String TENANT_LINKS_SEPARATOR = ",";

    @Override
    public void handleRequest(Operation op) {
        if (op.getAction() != Action.GET) {
            Operation.failActionNotSupported(op);
            return;
        }

        handleGet(op);
    }

    @Override
    public void handleGet(Operation get) {
        try {
            URI registryAdapterUri = HostInitRegistryAdapterServiceConfig.registryAdapterReference;
            AssertUtil.assertNotNull(registryAdapterUri, "registryAdapterReference");

            Map<String, String> queryParams = UriUtils.parseUriQueryParams(get.getUri());

            String imageName = queryParams.get(SEARCH_QUERY_PROP_NAME);
            AssertUtil.assertNotNull(registryAdapterUri, SEARCH_QUERY_PROP_NAME);

            String rawTenantLinks = queryParams.get(TENANT_LINKS_PARAM_NAME);

            HashSet<String> tenantLinks = new HashSet<>();
            if (rawTenantLinks != null && !rawTenantLinks.isEmpty()) {
                tenantLinks.addAll(Arrays.asList(rawTenantLinks.split(TENANT_LINKS_SEPARATOR)));
            }

            String projectHeader = OperationUtil.extractProjectFromHeader(get);
            if (projectHeader != null && !projectHeader.isEmpty()) {
                tenantLinks.add(projectHeader);
            }

            handleListTagsRequest(get, registryAdapterUri, imageName, tenantLinks);
        } catch (Exception x) {
            logSevere(x);
            get.fail(x);
        }
    }

    private void handleListTagsRequest(Operation op, URI registryAdapterUri, String imageName,
            Collection<String> tenantLinks) {

        DockerImage image = DockerImage.fromImageName(imageName);

        if (image.getHost() == null) {
            sendListTagRequest(op, registryAdapterUri, imageName, DEFAULT_INSTANCE_LINK);
            return;
        }

        RegistryUtil.findRegistriesByHostname(getHost(), image.getHost(), tenantLinks,
                (links, errors) -> {
                    if (errors != null && !errors.isEmpty()) {
                        op.fail(errors.iterator().next());
                        return;
                    }

                    if (links.isEmpty()) {
                        String errMsg = String.format(
                                "Failed to find registry state with address '%s'.",
                                image.getHost());
                        getHost().log(Level.WARNING, errMsg);
                        op.fail(new Exception(errMsg));
                        return;
                    }

                    sendListTagRequest(op, registryAdapterUri, imageName, links.iterator().next());
                });
    }

    private void sendListTagRequest(Operation op, URI registryAdapterUri, String imageName,
            String registryLink) {

        AdapterRequest listTagsRequest = new AdapterRequest();
        listTagsRequest.operationTypeId = ImageOperationType.LIST_TAGS.id;
        listTagsRequest.serviceTaskCallback = ServiceTaskCallback.createEmpty();
        listTagsRequest.resourceReference = UriUtils.buildPublicUri(getHost(), registryLink);
        listTagsRequest.customProperties = Collections.singletonMap(SEARCH_QUERY_PROP_NAME,
                imageName);

        Operation adapterOp = Operation.createPatch(registryAdapterUri)
                .setBody(listTagsRequest)
                .setCompletion((o, e) -> {
                    if (e != null) {
                        op.fail(e);
                        return;
                    }

                    op.setBody(o.getBodyRaw());
                    op.complete();
                });

        sendRequest(adapterOp);;
    }

    @Override
    public ServiceDocument getDocumentTemplate() {
        ServiceDocument d = super.getDocumentTemplate();
        addServiceRequestRoute(d, Action.GET,
                String.format("Search for tags for given image. Specify the name of the resource "
                                + "you are searching for with URI query with key \"%s\".",
                        SEARCH_QUERY_PROP_NAME), String.class);
        return d;
    }
}
