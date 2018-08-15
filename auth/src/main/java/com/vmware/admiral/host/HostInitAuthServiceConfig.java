/*
 * Copyright (c) 2017 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral.host;

import static com.vmware.photon.controller.model.util.StartServicesHelper.ServiceMetadata.factoryService;
import static com.vmware.photon.controller.model.util.StartServicesHelper.ServiceMetadata.service;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;

import com.vmware.admiral.auth.AuthInitialBootService;
import com.vmware.admiral.auth.idm.PrincipalService;
import com.vmware.admiral.auth.idm.SessionService;
import com.vmware.admiral.auth.idm.content.AuthContentService;
import com.vmware.admiral.auth.idm.local.LocalPrincipalFactoryService;
import com.vmware.admiral.auth.project.ProjectFactoryService;
import com.vmware.admiral.service.common.AuthBootstrapService;
import com.vmware.photon.controller.model.util.StartServicesHelper.ServiceMetadata;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.ServiceDocument;
import com.vmware.xenon.common.ServiceHost;
import com.vmware.xenon.common.UriUtils;

public class HostInitAuthServiceConfig extends HostInitServiceHelper {

    public static final Collection<ServiceMetadata> SERVICES_METADATA = Collections
            .unmodifiableList(Arrays.asList(
                    factoryService(AuthBootstrapService.class).requirePrivileged(true),
                    service(AuthInitialBootService.class),
                    service(SessionService.class),
                    service(ProjectFactoryService.class),
                    service(PrincipalService.class),
                    service(LocalPrincipalFactoryService.class),
                    service(AuthContentService.class)));

    public static void startServices(ServiceHost host) {

        startServices(host,
                AuthInitialBootService.class,
                SessionService.class,
                ProjectFactoryService.class,
                PrincipalService.class,
                LocalPrincipalFactoryService.class,
                AuthContentService.class);

        startServiceFactories(host,
                AuthBootstrapService.class);

        // start initialization of system documents
        host.sendRequest(Operation
                .createPost(UriUtils.buildUri(host, AuthInitialBootService.class))
                .addPragmaDirective(Operation.PRAGMA_DIRECTIVE_QUEUE_FOR_SERVICE_AVAILABILITY)
                .setReferer(host.getUri())
                .setBody(new ServiceDocument()));
    }
}