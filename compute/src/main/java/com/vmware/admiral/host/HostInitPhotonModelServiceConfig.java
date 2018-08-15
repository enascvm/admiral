/*
 * Copyright (c) 2016-2017 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral.host;

import java.util.Arrays;
import java.util.Collection;
import java.util.logging.Level;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.vmware.photon.controller.model.PhotonModelMetricServices;
import com.vmware.photon.controller.model.PhotonModelServices;
import com.vmware.photon.controller.model.adapters.registry.PhotonModelAdaptersRegistryAdapters;
import com.vmware.photon.controller.model.resources.ResourceState;
import com.vmware.photon.controller.model.security.PhotonModelSecurityServices;
import com.vmware.photon.controller.model.security.ssl.ServerX509TrustManager;
import com.vmware.photon.controller.model.tasks.PhotonModelTaskServices;
import com.vmware.photon.controller.model.util.StartServicesHelper.ServiceMetadata;
import com.vmware.xenon.common.ServiceHost;
import com.vmware.xenon.common.Utils;
import com.vmware.xenon.common.serialization.JsonMapper;

public class HostInitPhotonModelServiceConfig {

    public static void startServices(ServiceHost host) throws Throwable {

        // Null values in ResourceState.customProperties are ignored when serializing to JSON
        // although needed for the remove PATCH operation to work. To solve this, we register
        // a custom gson object for the base ResourceState where null values are serialized.
        // Note:
        //   1) This will also serialize all null fields in the ResourceState object.
        //   2) This will get trigger only if the PATCH body is a ResourceState object and *not*
        //      its subclass.
        Utils.registerCustomJsonMapper(ResourceState.class, new JsonMapper(b -> {
            b.serializeNulls();
        }));

        PhotonModelServices.startServices(host);
        PhotonModelTaskServices.startServices(host);
        PhotonModelMetricServices.startServices(host);

        try {
            PhotonModelSecurityServices.startServices(host);
            host.registerForServiceAvailability((o, e) -> ServerX509TrustManager.create(host),
                    true, PhotonModelAdaptersRegistryAdapters.LINKS);
        } catch (Throwable e) {
            host.log(Level.WARNING,
                    "Exception staring photon model security services: %s",
                    Utils.toString(e));
        }

        try {
            PhotonModelAdaptersRegistryAdapters.startServices(host);
        } catch (Throwable e) {
            host.log(Level.WARNING,
                    "Exception staring photon model adapter registry: %s",
                    Utils.toString(e));
        }
    }

    public static Collection<ServiceMetadata> getServiceMetadata() {
        // add all services even if they are remote in this particular configuration
        // this ensures the db schema is the same in different configurations and validation passes
        return Stream.of(
                PhotonModelServices.SERVICES_METADATA,
                PhotonModelTaskServices.SERVICES_METADATA,
                PhotonModelMetricServices.SERVICES_METADATA,
                PhotonModelSecurityServices.SERVICES_METADATA)

                .flatMap(Arrays::stream)
                .collect(Collectors.toList());
    }

}
