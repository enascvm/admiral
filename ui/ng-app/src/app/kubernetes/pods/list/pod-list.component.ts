/*
 * Copyright (c) 2017-2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

import { Component } from '@angular/core';
import { Links } from '../../../utils/links';

const REGISTRY_SCHEME_REG_EXP = /^(https?):\/\//;
const SECTION_SEPARATOR = '/';
const TAG_SEPARATOR = ':';
const NAMESPACE_REG_EXP = /^[a-z0-9_]+$/;

function isValidNamespace(namespaceCandidate) {
  return NAMESPACE_REG_EXP.test(namespaceCandidate);
}

function getImageNamespaceAndNameFromParts(namespace, imageAndTag) {
  var imageOnly = imageAndTag;
  var tagIndex = imageAndTag.indexOf(TAG_SEPARATOR);
  if (tagIndex !== -1) {
    imageOnly = imageAndTag.substring(0, tagIndex);
  }

  if (namespace) {
    return namespace + SECTION_SEPARATOR + imageOnly;
  }

  return imageOnly;
}

@Component({
  selector: 'pod-list',
  templateUrl: './pod-list.component.html',
  styleUrls: ['./pod-list.component.scss']
})
/**
 * Pods list view.
 */
export class PodListComponent {
    serviceEndpoint = Links.PODS;

    selectedItem: any;

    isItemSelected(item: any) {
        return item === this.selectedItem;
    }

    toggleItemSelection($event, item) {
        $event.stopPropagation();

        if (this.isItemSelected(item)) {
            // clear selection
            this.selectedItem = null;
        } else {
            this.selectedItem = item;
        }
    }

    getImageNamespaceAndName(image) {
        var imageWithoutScheme = image.replace(REGISTRY_SCHEME_REG_EXP, '');
        var parts = imageWithoutScheme.split(SECTION_SEPARATOR);

        switch (parts.length) {
            case 1:
                // only one section - it is the repository name with optional tag
                return getImageNamespaceAndNameFromParts(null, parts[0]);

            case 2:
                // since there are two sections the second one can be either a host or a namespace
                if (isValidNamespace(parts[0])) {
                    return getImageNamespaceAndNameFromParts(parts[0], parts[1]);
                }
                return getImageNamespaceAndNameFromParts(null, parts[1]);

            case 3:
                // all sections present
                return getImageNamespaceAndNameFromParts(parts[1], parts[2]);

            default:
                throw new Error('Invalid image format: ' + image);
            }
    }

    getImageIconLink(image) {
        if (!image) {
            return;
        }

        return '/container-image-icons?container-image=' + this.getImageNamespaceAndName(image);
    }
}
