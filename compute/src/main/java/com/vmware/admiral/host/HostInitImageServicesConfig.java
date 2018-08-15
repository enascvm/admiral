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

package com.vmware.admiral.host;

import static com.vmware.photon.controller.model.util.StartServicesHelper.ServiceMetadata.service;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;

import com.vmware.admiral.image.service.ContainerImageService;
import com.vmware.admiral.image.service.ContainerImageTagsService;
import com.vmware.admiral.image.service.PopularImagesService;
import com.vmware.photon.controller.model.util.StartServicesHelper.ServiceMetadata;
import com.vmware.xenon.common.ServiceHost;

public class HostInitImageServicesConfig extends HostInitServiceHelper {

    public static final Collection<ServiceMetadata> SERVICES_METADATA = Collections
            .unmodifiableList(Arrays.asList(
                    service(ContainerImageService.class),
                    service(ContainerImageTagsService.class),
                    service(PopularImagesService.class)));

    public static void startServices(ServiceHost host) {
        startServices(host, ContainerImageService.class, ContainerImageTagsService.class,
                PopularImagesService.class);
    }

}
