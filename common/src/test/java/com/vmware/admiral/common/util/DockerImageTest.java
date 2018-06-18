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

package com.vmware.admiral.common.util;

import static org.junit.Assert.assertEquals;

import java.util.ArrayList;
import java.util.List;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;

/**
 * Test for DockerImage parsing methods
 */
@RunWith(Parameterized.class)
public class DockerImageTest {
    private final String description;
    private final String fullImageName;
    private final String expectedHost;
    private final String expectedNamespace;
    private final String expectedRepo;
    private final String expectedNamespaceAndRepo;
    private final String expectedTag;

    @Parameters
    public static List<String[]> data() {
        List<String[]> data = new ArrayList<>();
        data.add(new String[] { "all sections", "myhost:300/namespace/repo:tag", "myhost:300",
                "namespace", "repo", "namespace/repo", "tag" });

        data.add(new String[] { "repo and tag", "repo:tag", null, null, "repo", "library/repo",
                "tag" });

        data.add(new String[] { "implicit registry, repo and tag", "library/repo:tag", null,
                "library", "repo", "library/repo", "tag" });

        data.add(new String[] { "repo without tag", "repo", null, null, "repo", "library/repo",
                "latest" });

        data.add(new String[] { "namespace and repo", "namespace/repo", null, "namespace", "repo",
                "namespace/repo", "latest" });

        data.add(new String[] { "host with dot and repo", "host.name:443/repo", "host.name:443",
                null, "repo", "repo", "latest" });

        data.add(new String[] { "host with colon and repo", "host:3000/repo", "host:3000", null,
                "repo", "repo", "latest" });

        data.add(new String[] { "host with colon, repo and tag", "host:3000/repo:tag", "host:3000",
                null, "repo", "repo", "tag" });

        data.add(new String[] { "official repo with default namespace",
                "registry.hub.docker.com/library/repo:tag", "registry.hub.docker.com", "library",
                "repo", "library/repo", "tag" });

        data.add(new String[] { "official repo with custom namespace",
                "registry.hub.docker.com/user/repo:tag", "registry.hub.docker.com", "user", "repo",
                "user/repo", "tag" });

        data.add(new String[] { "official repo with default namespace",
                "docker.io/library/repo:tag", "docker.io", "library", "repo", "library/repo",
                "tag" });

        data.add(new String[] { "official repo with custom namespace",
                "docker.io/user/repo:tag", "docker.io", "user", "repo", "user/repo", "tag" });

        data.add(new String[] { "host and three path components of repo",
                "host/namespace/category/repo", "host", "namespace/category", "repo",
                "namespace/category/repo", "latest" });

        data.add(new String[] { "host, port, three path components of repo and tag",
                "host:5000/namespace/category/repo:tag", "host:5000", "namespace/category", "repo",
                "namespace/category/repo", "tag" });

        data.add(new String[] { "host, port, three path components containing dash, repo and tag",
                "host:5000/namespace-project/category/repo:tag", "host:5000",
                "namespace-project/category", "repo", "namespace-project/category/repo", "tag" });

        data.add(new String[] { "host with dot, two path components of repo and tag",
                "host-123.local/library/repo:tag", "host-123.local", "library", "repo",
                "library/repo", "tag" });

        data.add(new String[] { "host, two path components of repo and tag",
                "host-123/library/repo:tag", "host-123", "library", "repo",
                "library/repo", "tag" });

        data.add(new String[] { "host, repo and tag",
                "host-123:443/repo:tag", "host-123:443", null, "repo",
                "repo", "tag" });

        return data;
    }

    /**
     * @param expectedHost
     * @param expectedNamespace
     * @param expectedRepo
     */
    public DockerImageTest(String description, String fullImageName, String expectedHost,
            String expectedNamespace,
            String expectedRepo,
            String expectedNamespaceAndRepo,
            String expectedTag) {

        this.description = description;
        this.fullImageName = fullImageName;
        this.expectedHost = expectedHost;
        this.expectedNamespace = expectedNamespace;
        this.expectedRepo = expectedRepo;
        this.expectedNamespaceAndRepo = expectedNamespaceAndRepo;
        this.expectedTag = expectedTag;
    }

    @Test
    public void testDockerImageParsing() {

        DockerImage dockerImage = DockerImage.fromImageName(fullImageName);
        assertEquals(description + ": host", expectedHost, dockerImage.getHost());
        assertEquals(description + ": namespace", expectedNamespace, dockerImage.getNamespace());
        assertEquals(description + ": repository", expectedRepo, dockerImage.getRepository());
        assertEquals(description + ": namespace and repo", expectedNamespaceAndRepo,
                dockerImage.getNamespaceAndRepo());
        assertEquals(description + ": tag", expectedTag, dockerImage.getTag());
    }
}
