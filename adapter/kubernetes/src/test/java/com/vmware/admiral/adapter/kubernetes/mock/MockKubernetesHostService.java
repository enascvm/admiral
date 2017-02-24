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

package com.vmware.admiral.adapter.kubernetes.mock;

import static com.vmware.admiral.adapter.kubernetes.mock.MockKubernetesPathConstants.BASE_PATH;

import java.net.URI;

import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.ServiceDocument;
import com.vmware.xenon.common.StatefulService;

public class MockKubernetesHostService extends StatefulService {
    public static final String SELF_LINK = BASE_PATH;

    public MockKubernetesHostService() {
        super(ServiceDocument.class);
    }

    @Override
    public void handleGet(Operation get) {
        URI uri = get.getUri();
        if (uri.getPath().endsWith(MockKubernetesPathConstants.PING)) {
            get.setBody("ok");
            get.complete();
        } else if (uri.getPath().endsWith(MockKubernetesPathConstants.NAMESPACES)) {
            get.setBody(namespaceMock());
            get.complete();
        } else if (uri.getPath().endsWith(MockKubernetesPathConstants.PODS)) {
            get.setBody(podsMock());
            get.complete();
        } else if (uri.getPath().endsWith(MockKubernetesPathConstants.NODES)) {
            get.setBody(nodesMock());
            get.complete();
        } else if (uri.getPath().contains(MockKubernetesPathConstants.DASHBOARD_PROXY_FOR_STATS)) {
            get.setBody(statsProxyMock());
            get.complete();
        } else {
            get.fail(new IllegalStateException("Operation not supported."));
        }
    }

    private String namespaceMock() {
        return "{\n"
                + "  \"kind\": \"NamespaceList\",\n"
                + "  \"apiVersion\": \"v1\",\n"
                + "  \"metadata\": {\n"
                + "    \"selfLink\": \"/api/v1/namespaces\",\n"
                + "    \"resourceVersion\": \"1732355\"\n"
                + "  },\n"
                + "  \"items\": [\n"
                + "    {\n"
                + "      \"metadata\": {\n"
                + "        \"name\": \"default\",\n"
                + "        \"selfLink\": \"/api/v1/namespaces/default\",\n"
                + "        \"uid\": \"481b369e-d658-11e6-9ae1-0050569de380\",\n"
                + "        \"resourceVersion\": \"7\",\n"
                + "        \"creationTimestamp\": \"2017-01-09T10:42:13Z\"\n"
                + "      },\n"
                + "      \"spec\": {\n"
                + "        \"finalizers\": [\n"
                + "          \"kubernetes\"\n"
                + "        ]\n"
                + "      },\n"
                + "      \"status\": {\n"
                + "        \"phase\": \"Active\"\n"
                + "      }\n"
                + "    },\n"
                + "    {\n"
                + "      \"metadata\": {\n"
                + "        \"name\": \"kube-system\",\n"
                + "        \"selfLink\": \"/api/v1/namespaces/kube-system\",\n"
                + "        \"uid\": \"48942bef-d658-11e6-9ae1-0050569de380\",\n"
                + "        \"resourceVersion\": \"54\",\n"
                + "        \"creationTimestamp\": \"2017-01-09T10:42:14Z\",\n"
                + "        \"annotations\": {\n"
                + "          \"kubectl.kubernetes.io/last-applied-configuration\": \"{\\\"kind\\\":\\\"Namespace\\\",\\\"apiVersion\\\":\\\"v1\\\",\\\"metadata\\\":{\\\"name\\\":\\\"kube-system\\\",\\\"creationTimestamp\\\":null},\\\"spec\\\":{},\\\"status\\\":{}}\"\n"
                + "        }\n"
                + "      },\n"
                + "      \"spec\": {\n"
                + "        \"finalizers\": [\n"
                + "          \"kubernetes\"\n"
                + "        ]\n"
                + "      },\n"
                + "      \"status\": {\n"
                + "        \"phase\": \"Active\"\n"
                + "      }\n"
                + "    },\n"
                + "    {\n"
                + "      \"metadata\": {\n"
                + "        \"name\": \"test-namespace\",\n"
                + "        \"selfLink\": \"/api/v1/namespaces/test-namespace\",\n"
                + "        \"uid\": \"62a079a1-e308-11e6-9ae1-0050569de380\",\n"
                + "        \"resourceVersion\": \"1732291\",\n"
                + "        \"creationTimestamp\": \"2017-01-25T14:13:03Z\"\n"
                + "      },\n"
                + "      \"spec\": {\n"
                + "        \"finalizers\": [\n"
                + "          \"kubernetes\"\n"
                + "        ]\n"
                + "      },\n"
                + "      \"status\": {\n"
                + "        \"phase\": \"Active\"\n"
                + "      }\n"
                + "    }\n"
                + "  ]\n"
                + "}";
    }

    private String podsMock() {
        return "{\n"
                + "  \"kind\": \"PodList\",\n"
                + "  \"apiVersion\": \"v1\",\n"
                + "  \"metadata\": {\n"
                + "    \"selfLink\": \"/api/v1/namespaces/default/pods\",\n"
                + "    \"resourceVersion\": \"1733267\"\n"
                + "  },\n"
                + "  \"items\": [\n"
                + "    {\n"
                + "      \"metadata\": {\n"
                + "        \"name\": \"nginx-mysql\",\n"
                + "        \"namespace\": \"default\",\n"
                + "        \"selfLink\": \"/api/v1/namespaces/default/pods/nginx-mysql\",\n"
                + "        \"uid\": \"f0e16f00-d800-11e6-9ae1-0050569de380\",\n"
                + "        \"resourceVersion\": \"1733031\",\n"
                + "        \"creationTimestamp\": \"2017-01-11T13:22:03Z\"\n"
                + "      },\n"
                + "      \"spec\": {\n"
                + "        \"volumes\": [\n"
                + "          {\n"
                + "            \"name\": \"default-token-bj5xs\",\n"
                + "            \"secret\": {\n"
                + "              \"secretName\": \"default-token-bj5xs\",\n"
                + "              \"defaultMode\": 420\n"
                + "            }\n"
                + "          }\n"
                + "        ],\n"
                + "        \"containers\": [\n"
                + "          {\n"
                + "            \"name\": \"nginx\",\n"
                + "            \"image\": \"nginx\",\n"
                + "            \"ports\": [\n"
                + "              {\n"
                + "                \"hostPort\": 85,\n"
                + "                \"containerPort\": 80,\n"
                + "                \"protocol\": \"TCP\"\n"
                + "              }\n"
                + "            ],\n"
                + "            \"env\": [\n"
                + "              {\n"
                + "                \"name\": \"MESSAGE\",\n"
                + "                \"value\": \"hello nginx\"\n"
                + "              }\n"
                + "            ],\n"
                + "            \"resources\": {},\n"
                + "            \"volumeMounts\": [\n"
                + "              {\n"
                + "                \"name\": \"default-token-bj5xs\",\n"
                + "                \"readOnly\": true,\n"
                + "                \"mountPath\": \"/var/run/secrets/kubernetes.io/serviceaccount\"\n"
                + "              }\n"
                + "            ],\n"
                + "            \"terminationMessagePath\": \"/dev/termination-log\",\n"
                + "            \"imagePullPolicy\": \"Always\"\n"
                + "          },\n"
                + "          {\n"
                + "            \"name\": \"mysql\",\n"
                + "            \"image\": \"mysql\",\n"
                + "            \"ports\": [\n"
                + "              {\n"
                + "                \"hostPort\": 3306,\n"
                + "                \"containerPort\": 3306,\n"
                + "                \"protocol\": \"TCP\"\n"
                + "              }\n"
                + "            ],\n"
                + "            \"env\": [\n"
                + "              {\n"
                + "                \"name\": \"MESSAGE\",\n"
                + "                \"value\": \"hello mysql\"\n"
                + "              }\n"
                + "            ],\n"
                + "            \"resources\": {},\n"
                + "            \"volumeMounts\": [\n"
                + "              {\n"
                + "                \"name\": \"default-token-bj5xs\",\n"
                + "                \"readOnly\": true,\n"
                + "                \"mountPath\": \"/var/run/secrets/kubernetes.io/serviceaccount\"\n"
                + "              }\n"
                + "            ],\n"
                + "            \"terminationMessagePath\": \"/dev/termination-log\",\n"
                + "            \"imagePullPolicy\": \"Always\"\n"
                + "          }\n"
                + "        ],\n"
                + "        \"restartPolicy\": \"Always\",\n"
                + "        \"terminationGracePeriodSeconds\": 30,\n"
                + "        \"dnsPolicy\": \"ClusterFirst\",\n"
                + "        \"serviceAccountName\": \"default\",\n"
                + "        \"serviceAccount\": \"default\",\n"
                + "        \"nodeName\": \"127.0.0.1\",\n"
                + "        \"securityContext\": {}\n"
                + "      },\n"
                + "      \"status\": {\n"
                + "        \"phase\": \"Running\",\n"
                + "        \"conditions\": [\n"
                + "          {\n"
                + "            \"type\": \"Initialized\",\n"
                + "            \"status\": \"True\",\n"
                + "            \"lastProbeTime\": null,\n"
                + "            \"lastTransitionTime\": \"2017-01-11T13:22:03Z\"\n"
                + "          },\n"
                + "          {\n"
                + "            \"type\": \"Ready\",\n"
                + "            \"status\": \"False\",\n"
                + "            \"lastProbeTime\": null,\n"
                + "            \"lastTransitionTime\": \"2017-01-25T14:22:53Z\",\n"
                + "            \"reason\": \"ContainersNotReady\",\n"
                + "            \"message\": \"containers with unready status: [mysql]\"\n"
                + "          },\n"
                + "          {\n"
                + "            \"type\": \"PodScheduled\",\n"
                + "            \"status\": \"True\",\n"
                + "            \"lastProbeTime\": null,\n"
                + "            \"lastTransitionTime\": \"2017-01-11T13:22:03Z\"\n"
                + "          }\n"
                + "        ],\n"
                + "        \"hostIP\": \"127.0.0.1\",\n"
                + "        \"podIP\": \"172.17.0.5\",\n"
                + "        \"startTime\": \"2017-01-11T13:22:03Z\",\n"
                + "        \"containerStatuses\": [\n"
                + "          {\n"
                + "            \"name\": \"mysql\",\n"
                + "            \"state\": {\n"
                + "              \"waiting\": {\n"
                + "                \"reason\": \"CrashLoopBackOff\",\n"
                + "                \"message\": \"Back-off 5m0s restarting failed container=mysql pod=nginx-mysql_default(f0e16f00-d800-11e6-9ae1-0050569de380)\"\n"
                + "              }\n"
                + "            },\n"
                + "            \"lastState\": {\n"
                + "              \"terminated\": {\n"
                + "                \"exitCode\": 1,\n"
                + "                \"reason\": \"Error\",\n"
                + "                \"startedAt\": \"2017-01-25T14:22:50Z\",\n"
                + "                \"finishedAt\": \"2017-01-25T14:22:52Z\",\n"
                + "                \"containerID\": \"docker://e781145ccd32b00f8cf2ea3042c10102aed2309831fd386197185513421bf614\"\n"
                + "              }\n"
                + "            },\n"
                + "            \"ready\": false,\n"
                + "            \"restartCount\": 3898,\n"
                + "            \"image\": \"mysql\",\n"
                + "            \"imageID\": \"docker-pullable://mysql@sha256:79690dd87d68fd4d801e65f5479f8865d572a6c7ac073c9273713a9c633022c5\",\n"
                + "            \"containerID\": \"docker://e781145ccd32b00f8cf2ea3042c10102aed2309831fd386197185513421bf614\"\n"
                + "          },\n"
                + "          {\n"
                + "            \"name\": \"nginx\",\n"
                + "            \"state\": {\n"
                + "              \"running\": {\n"
                + "                \"startedAt\": \"2017-01-11T13:22:08Z\"\n"
                + "              }\n"
                + "            },\n"
                + "            \"lastState\": {},\n"
                + "            \"ready\": true,\n"
                + "            \"restartCount\": 0,\n"
                + "            \"image\": \"nginx\",\n"
                + "            \"imageID\": \"docker-pullable://nginx@sha256:fab482910aae9630c93bd24fc6fcecb9f9f792c24a8974f5e46d8ad625ac2357\",\n"
                + "            \"containerID\": \"docker://48896e7338126c05b0ccc9f73cda870f01563a4de8cb214f206dc8b4ff3f7230\"\n"
                + "          }\n"
                + "        ]\n"
                + "      }\n"
                + "    }\n"
                + "  ]\n"
                + "}";
    }

    private String nodesMock() {
        return "{\n"
                + "  \"kind\": \"NodeList\",\n"
                + "  \"apiVersion\": \"v1\",\n"
                + "  \"metadata\": {\n"
                + "    \"selfLink\": \"/api/v1/nodes\",\n"
                + "    \"resourceVersion\": \"2709530\"\n"
                + "  },\n"
                + "  \"items\": [\n"
                + "    {\n"
                + "      \"metadata\": {\n"
                + "        \"name\": \"127.0.0.1\",\n"
                + "        \"selfLink\": \"/api/v1/nodes127.0.0.1\",\n"
                + "        \"uid\": \"48876cb7-d658-11e6-9ae1-0050569de380\",\n"
                + "        \"resourceVersion\": \"2709521\",\n"
                + "        \"creationTimestamp\": \"2017-01-09T10:42:14Z\",\n"
                + "        \"labels\": {\n"
                + "          \"beta.kubernetes.io/arch\": \"amd64\",\n"
                + "          \"beta.kubernetes.io/os\": \"linux\",\n"
                + "          \"kubernetes.io/hostname\": \"127.0.0.1\"\n"
                + "        },\n"
                + "        \"annotations\": {\n"
                + "          \"volumes.kubernetes.io/controller-managed-attach-detach\": \"true\"\n"
                + "        }\n"
                + "      },\n"
                + "      \"spec\": {\n"
                + "        \"externalID\": \"127.0.0.1\"\n"
                + "      },\n"
                + "      \"status\": {\n"
                + "        \"capacity\": {\n"
                + "          \"alpha.kubernetes.io/nvidia-gpu\": \"0\",\n"
                + "          \"cpu\": \"4\",\n"
                + "          \"memory\": \"8011180Ki\",\n"
                + "          \"pods\": \"110\"\n"
                + "        },\n"
                + "        \"allocatable\": {\n"
                + "          \"alpha.kubernetes.io/nvidia-gpu\": \"0\",\n"
                + "          \"cpu\": \"4\",\n"
                + "          \"memory\": \"8011180Ki\",\n"
                + "          \"pods\": \"110\"\n"
                + "        },\n"
                + "        \"addresses\": [\n"
                + "          {\n"
                + "            \"type\": \"LegacyHostIP\",\n"
                + "            \"address\": \"127.0.0.1\"\n"
                + "          },\n"
                + "          {\n"
                + "            \"type\": \"InternalIP\",\n"
                + "            \"address\": \"127.0.0.1\"\n"
                + "          },\n"
                + "          {\n"
                + "            \"type\": \"Hostname\",\n"
                + "            \"address\": \"127.0.0.1\"\n"
                + "          }\n"
                + "        ],\n"
                + "        \"nodeInfo\": {\n"
                + "          \"machineID\": \"cf742c5b2ef64b18a93d3785f5444d22\",\n"
                + "          \"systemUUID\": \"421D99A3-F381-0EE4-8517-7B2B1FDB9C83\",\n"
                + "          \"bootID\": \"56139095-c991-4a8f-8d67-c0631bb770d7\",\n"
                + "          \"kernelVersion\": \"3.10.0-327.36.3.el7.x86_64\",\n"
                + "          \"osImage\": \"Debian GNU/Linux 8 (jessie)\",\n"
                + "          \"containerRuntimeVersion\": \"docker://1.12.3\",\n"
                + "          \"kubeletVersion\": \"v1.5.1\",\n"
                + "          \"kubeProxyVersion\": \"v1.5.1\",\n"
                + "          \"operatingSystem\": \"linux\",\n"
                + "          \"architecture\": \"amd64\"\n"
                + "        }\n"
                + "      }\n"
                + "    }\n"
                + "  ]\n"
                + "}";
    }

    private String statsProxyMock() {
        return "{\n"
                + "  \"objectMeta\": {\n"
                + "   \"name\": \"127.0.0.1\",\n"
                + "   \"labels\": {\n"
                + "    \"beta.kubernetes.io/arch\": \"amd64\",\n"
                + "    \"beta.kubernetes.io/os\": \"linux\",\n"
                + "    \"kubernetes.io/hostname\": \"127.0.0.1\"\n"
                + "   },\n"
                + "   \"annotations\": {\n"
                + "    \"volumes.kubernetes.io/controller-managed-attach-detach\": \"true\"\n"
                + "   },\n"
                + "   \"creationTimestamp\": \"2017-01-09T10:42:14Z\"\n"
                + "  },\n"
                + "  \"typeMeta\": {\n"
                + "   \"kind\": \"node\"\n"
                + "  },\n"
                + "  \"allocatedResources\": {\n"
                + "   \"cpuRequests\": 365,\n"
                + "   \"cpuRequestsFraction\": 9.125,\n"
                + "   \"cpuLimits\": 100,\n"
                + "   \"cpuLimitsFraction\": 2.5,\n"
                + "   \"cpuCapacity\": 4000,\n"
                + "   \"memoryRequests\": 251658240,\n"
                + "   \"memoryRequestsFraction\": 3.067712871262411,\n"
                + "   \"memoryLimits\": 283115520,\n"
                + "   \"memoryLimitsFraction\": 3.451176980170212,\n"
                + "   \"memoryCapacity\": 8203448320,\n"
                + "   \"allocatedPods\": 7,\n"
                + "   \"podCapacity\": 110\n"
                + "  },\n"
                + "  \"externalID\": \"127.0.0.1\",\n"
                + "  \"podCIDR\": \"\",\n"
                + "  \"providerID\": \"\",\n"
                + "  \"unschedulable\": false,\n"
                + "  \"nodeInfo\": {\n"
                + "   \"machineID\": \"cf742c5b2ef64b18a93d3785f5444d22\",\n"
                + "   \"systemUUID\": \"421D99A3-F381-0EE4-8517-7B2B1FDB9C83\",\n"
                + "   \"bootID\": \"56139095-c991-4a8f-8d67-c0631bb770d7\",\n"
                + "   \"kernelVersion\": \"3.10.0-327.36.3.el7.x86_64\",\n"
                + "   \"osImage\": \"Debian GNU/Linux 8 (jessie)\",\n"
                + "   \"containerRuntimeVersion\": \"docker://1.12.3\",\n"
                + "   \"kubeletVersion\": \"v1.5.1\",\n"
                + "   \"kubeProxyVersion\": \"v1.5.1\",\n"
                + "   \"operatingSystem\": \"linux\",\n"
                + "   \"architecture\": \"amd64\"\n"
                + "  },\n"
                + "  \"podList\": {\n"
                + "   \"listMeta\": {\n"
                + "    \"totalItems\": 7\n"
                + "   }\n"
                + "  }\n"
                + " }";
    }
}