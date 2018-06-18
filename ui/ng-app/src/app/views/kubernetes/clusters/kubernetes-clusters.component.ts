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

import { Component, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentService } from '../../../utils/document.service';
import { Constants } from '../../../utils/constants';
import { GridViewComponent } from '../../../components/grid-view/grid-view.component';
import { ProjectService } from "../../../utils/project.service";
import { AutoRefreshComponent } from '../../../components/base/auto-refresh.component';
import { FT } from '../../../utils/ft';
import { Utils } from '../../../utils/utils';
import { Links } from '../../../utils/links';
import * as I18n from 'i18next';

@Component({
    selector: 'app-kubernetes-clusters',
    templateUrl: './kubernetes-clusters.component.html',
    styleUrls: ['./kubernetes-clusters.component.scss']
})
/**
 * Kubernetes Clusters main grid view.
 */
export class KubernetesClustersComponent extends AutoRefreshComponent {

    @ViewChild('gridView') gridView: GridViewComponent;

    serviceEndpoint = Links.CLUSTERS + '?type=KUBERNETES';
    selectedItem: any;

    constructor(protected service: DocumentService, protected projectService: ProjectService,
        protected router: Router, protected route: ActivatedRoute) {
        super(router, route, FT.allowHostEventsSubscription(), Utils.getClustersViewRefreshInterval(), true);
    }

    nodeCount(cluster): string {
        var nodeLink = cluster.nodeLinks[0];
        var nodesJson = Utils.getCustomPropertyValue(cluster.nodes[nodeLink].customProperties, '__nodes');
        if (nodesJson) {
            return JSON.parse(nodesJson).length;
        }
        return 'N/A';
    }

    clusterState(cluster) {
        return I18n.t('clusters.state.' + cluster.status);
    }

    operationSupported(op, cluster) {
        if (op === 'ENABLE') {
            return cluster.status === Constants.clusters.status.DISABLED;
        } else if (op === 'DISABLE') {
            return cluster.status === Constants.clusters.status.ON;
        }

        return true;
    }

    enableHost(event, cluster) {
        event.stopPropagation();

        if (!cluster.nodeLinks || cluster.nodeLinks.length < 1) {
            return;
        }

        var hostLink = cluster.nodeLinks[0];

        this.service.patch(hostLink, {'powerState': Constants.hosts.state.ON})
        .then(result => {
            this.gridView.refresh();
        })
        .catch(err => {
            console.log(Utils.getErrorMessage(err)._generic);
        });

        return false; // prevents navigation
    }

    disableHost(event, cluster) {
        event.stopPropagation();

        if (!cluster.nodeLinks || cluster.nodeLinks.length < 1) {
            return;
        }

        var hostLink = cluster.nodeLinks[0];

        this.service.patch(hostLink, {'powerState': Constants.hosts.state.SUSPEND})
        .then(result => {
            this.gridView.refresh();
        })
        .catch(err => {
            console.log(Utils.getErrorMessage(err)._generic);
        });

        return false; // prevents navigation
    }

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
}