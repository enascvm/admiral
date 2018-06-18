/*
 * Copyright (c) 2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

package com.vmware.admiral.image.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.LinkedList;
import java.util.List;
import java.util.logging.Level;

import org.junit.Before;
import org.junit.Test;

import com.vmware.admiral.common.ManagementUriParts;
import com.vmware.admiral.compute.container.ComputeBaseTest;
import com.vmware.admiral.image.service.FavoriteImagesService.FavoriteImage;
import com.vmware.admiral.service.common.RegistryFactoryService;
import com.vmware.admiral.service.common.RegistryService.RegistryState;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.UriUtils;

public class FavoriteImagesServiceTest extends ComputeBaseTest {

    public static final String DEFAULT_REGISTRY = "https://registry.hub.docker.com";
    FavoriteImage nginxImage;
    FavoriteImage photonImage;
    FavoriteImage alpineImage;

    @Before
    public void setUp() throws Throwable {
        waitForServiceAvailability(FavoriteImageFactoryService.SELF_LINK);
        waitForServiceAvailability(RegistryFactoryService.SELF_LINK);
    }

    @Before
    public void initObjects() {
        nginxImage = new FavoriteImage();
        nginxImage.name = "library/nginx";
        nginxImage.description = "Official build of Nginx.";
        nginxImage.registry = DEFAULT_REGISTRY;

        photonImage = new FavoriteImage();
        photonImage.name = "library/photon";
        photonImage.description = "Photon OS is a technology preview of a minimal Linux container host.";
        photonImage.registry = DEFAULT_REGISTRY;

        alpineImage = new FavoriteImage();
        alpineImage.name = "library/alpine";
        alpineImage.description = "A minimal Docker image based on Alpine Linux with a complete "
                + "package index and only 5 MB in size!";
        alpineImage.registry = DEFAULT_REGISTRY;

    }

    @Test
    public void testAddAndRemoveImageFromFavorites() throws Throwable {
        FavoriteImage imageState = addImageToFavorites(nginxImage).getBody(FavoriteImage.class);

        validateImage(nginxImage, imageState);
        checkImages(nginxImage);

        removeImageFromFavorites(imageState);

        checkImages();
    }

    @Test
    public void testAddRemoveMultipleImagesFromFavorites() throws Throwable {
        FavoriteImage nginxImageState = addImageToFavorites(nginxImage)
                .getBody(FavoriteImage.class);
        FavoriteImage photonImageState = addImageToFavorites(photonImage)
                .getBody(FavoriteImage.class);
        FavoriteImage alpineImageState = addImageToFavorites(alpineImage)
                .getBody(FavoriteImage.class);

        validateImage(nginxImage, nginxImageState);
        validateImage(photonImage, photonImageState);
        validateImage(alpineImage, alpineImageState);
        checkImages(nginxImage, photonImage, alpineImage);

        removeImageFromFavorites(nginxImageState);
        checkImages(photonImage, alpineImage);

        removeImageFromFavorites(photonImageState);
        checkImages(alpineImage);

        removeImageFromFavorites(alpineImageState);
        checkImages();
    }

    @Test(expected = Exception.class)
    public void testAddImageToFavoritesNonexistentRegistry() throws Throwable {
        FavoriteImage fictionalRegistryImage = new FavoriteImage();
        fictionalRegistryImage.name = "library/photon";
        fictionalRegistryImage.description = "This is a non-existing image";
        fictionalRegistryImage.registry = "non-existing registry";

        Operation operationResponse = addImageToFavorites(fictionalRegistryImage);

        assertEquals(Operation.STATUS_CODE_BAD_REQUEST, operationResponse.getStatusCode());
        checkImages();
    }

    @Test(expected = Exception.class)
    public void testAddImageToFavoritesDisabledRegistry() throws Throwable {
        RegistryState registryState = disableDefaultRegistry().getBody(RegistryState.class);

        assertTrue(registryState.disabled);

        Operation operationResponse = addImageToFavorites(nginxImage);

        assertEquals(Operation.STATUS_CODE_BAD_REQUEST, operationResponse.getStatusCode());
        checkImages();
    }

    @Test(expected = Exception.class)
    public void testAddExistingImageToFavorites() throws Throwable {
        FavoriteImage nginxImageState = addImageToFavorites(nginxImage)
                .getBody(FavoriteImage.class);

        validateImage(nginxImage, nginxImageState);
        checkImages(nginxImage);

        Operation operationResponse = addImageToFavorites(nginxImage);

        assertEquals(Operation.STATUS_CODE_BAD_REQUEST, operationResponse.getStatusCode());
        checkImages(nginxImage);

        removeImageFromFavorites(nginxImageState);

        checkImages();
    }

    private void checkImages(FavoriteImage... expectedImages) throws Throwable {
        List<FavoriteImage> favorites = getDocumentsOfType(FavoriteImage.class);

        boolean containsExpectedImages = true;
        for (FavoriteImage i : expectedImages) {
            containsExpectedImages &= favorites.contains(i);
        }

        assertEquals(expectedImages.length, favorites.size());
        assertTrue(containsExpectedImages);
    }

    private Operation addImageToFavorites(FavoriteImage imageToAdd) {
        List<Operation> result = new LinkedList<>();
        Operation addToFavorites = Operation.createPost(
                UriUtils.buildUri(host, ManagementUriParts.FAVORITE_IMAGES))
                .setBody(imageToAdd)
                .setCompletion((o, e) -> {
                    if (e != null) {
                        host.log(Level.SEVERE, "Can't favorite image");
                        host.failIteration(e);
                    } else {
                        result.add(o);
                        host.completeIteration();
                    }
                });

        host.testStart(1);
        host.send(addToFavorites);
        host.testWait();

        return result.get(0);
    }

    private void removeImageFromFavorites(FavoriteImage imageToRemove) throws Throwable {
        Operation removeFromFavorites = Operation.createDelete(
                UriUtils.buildUri(host, imageToRemove.documentSelfLink))
                .setCompletion((o, e) -> {
                    if (e != null) {
                        host.log(Level.SEVERE, "Can't remove image from favorites");
                        host.failIteration(e);
                    } else {
                        host.completeIteration();
                    }
                });

        host.testStart(1);
        host.send(removeFromFavorites);
        host.testWait();
    }

    private void validateImage(FavoriteImage expected, FavoriteImage actual) {
        assertEquals(expected.name, actual.name);
        assertEquals(expected.description, actual.description);
        assertEquals(expected.registry, actual.registry);
    }

    private Operation disableDefaultRegistry() {
        List<Operation> result = new LinkedList<>();
        Operation disableRegistry = Operation.createPatch(UriUtils.buildUri(host,
                ManagementUriParts.REGISTRIES, "default-registries"))
                .setBody(new RegistryState().disabled = Boolean.TRUE)
                .setCompletion((o, e) -> {
                    if (e != null) {
                        host.log(Level.SEVERE, "Unable to disable registry");
                        host.failIteration(e);
                    } else {
                        result.add(o);
                        host.completeIteration();
                    }
                });

        host.testStart(1);
        host.send(disableRegistry);
        host.testWait();

        return result.get(0);
    }
}