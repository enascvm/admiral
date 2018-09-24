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

import java.util.Arrays;
import java.util.stream.Collectors;

import com.vmware.photon.controller.model.resources.ComputeDescriptionService.ComputeDescription.ComputeType;
import com.vmware.xenon.common.LocalizableValidationException;

public enum ResourceType {
    CONTAINER_TYPE(ComputeType.DOCKER_CONTAINER.toString(), "App.Container"),
    COMPOSITE_COMPONENT_TYPE("COMPOSITE_COMPONENT", ""),
    JOIN_COMPOSITE_COMPONENT_TYPE("JOIN_COMPOSITE_COMPONENT", ""),
    COMPUTE_TYPE("COMPUTE", "Compute"),
    CONTAINER_HOST_TYPE("CONTAINER_HOST", ""),
    NETWORK_TYPE("NETWORK", "App.Network"),
    VOLUME_TYPE("CONTAINER_VOLUME", "App.Volume"),
    CLOSURE_TYPE("CLOSURE", "App.Closure"),
    CONFIGURE_HOST_TYPE("CONFIGURE_HOST", ""),
    KUBERNETES_GENERIC_TYPE("KUBERNETES_GENERIC", "Kubernetes.Generic"),
    KUBERNETES_POD_TYPE("KUBERNETES_POD", "Kubernetes.Pod"),
    KUBERNETES_DEPLOYMENT_TYPE("KUBERNETES_DEPLOYMENT", "Kubernetes.Deployment"),
    KUBERNETES_SERVICE_TYPE("KUBERNETES_SERVICE", "Kubernetes.Service"),
    KUBERNETES_REPLICATION_CONTROLLER_TYPE("KUBERNETES_REPLICATION_CONTROLLER",
            "Kubernetes.ReplicationController"),
    KUBERNETES_REPLICA_SET_TYPE("KUBERNETES_REPLICA_SET", "Kubernetes.ReplicaSet"),
    PKS_CLUSTER_TYPE("PKS_CLUSTER","");

    private final String name;
    private final String contentType;

    private ResourceType(String name, String contentType) {
        this.name = name;
        this.contentType = contentType;
    }

    public String getName() {
        return name;
    }

    public String getContentType() {
        return contentType;
    }

    public static ResourceType fromName(String name) {
        if (name == null || "".equals(name)) {
            throw new LocalizableValidationException("Name cannot be null or empty!", "common.resource-type.name.empty");
        }
        for (ResourceType r : ResourceType.values()) {
            if (r.name.equals(name)) {
                return r;
            }
        }
        throw new LocalizableValidationException("No matching type for:" + name, "common.resource-type.name.mismatch", name);
    }

    public static ResourceType fromContentType(String contentType) {
        if (contentType == null || "".equals(contentType)) {
            throw new LocalizableValidationException("ContentType cannot be null or empty!", "common.resource-type.content-type.empty");
        }
        for (ResourceType r : ResourceType.values()) {
            if (r.contentType.equals(contentType)) {
                return r;
            }
        }
        throw new LocalizableValidationException("No matching type for:" + contentType,
                "common.resource-type.content-type.mismatch", contentType);
    }

    public static String getAllTypesAsString() {
        return Arrays.asList(ResourceType.values()).stream().map(Object::toString)
                .collect(Collectors.joining(", "));
    }
}
