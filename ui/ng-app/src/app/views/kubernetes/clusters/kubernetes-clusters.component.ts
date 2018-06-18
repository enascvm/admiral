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

    projectLink: string;

    serviceEndpoint = Links.CLUSTERS + '?type=KUBERNETES';
    selectedItem: any;

    clusterToDelete: any;
    deleteConfirmationAlert: string;

    constructor(protected service: DocumentService, protected projectService: ProjectService,
                protected router: Router, protected route: ActivatedRoute) {

        super(router, route, FT.allowHostEventsSubscription(),
                Utils.getClustersViewRefreshInterval(), true);

        projectService.activeProject.subscribe((value) => {
            if (value && value.documentSelfLink) {
                this.projectLink = value.documentSelfLink;
            } else if (value && value.id) {
                this.projectLink = value.id;
            } else {
                this.projectLink = undefined;
            }
        });
    }

    ngOnInit(): void {
        this.refreshFnCallScope = this.gridView;
        this.refreshFn = this.gridView.autoRefresh;

        super.ngOnInit();
    }

    get deleteTitle() {
        return this.clusterToDelete && this.clusterToDelete.name
                    && I18n.t('clusters.delete.title');
    }

    get deleteConfirmationDescription(): string {
        return this.clusterToDelete
                    && this.clusterToDelete.name
                    && I18n.t('clusters.delete.confirmation', {
                        clusterName: this.clusterToDelete.name,
                        interpolation: { escapeValue: false }
                    } as I18n.TranslationOptions);
    }

    hasNodes(cluster) {
        return cluster && cluster.nodes && cluster.nodeLinks && cluster.nodeLinks.length > 0;
    }

    getClusterCustomProperties(cluster) {
        let properties;
        if (this.hasNodes(cluster)) {
            properties = cluster.nodes[cluster.nodeLinks[0]].customProperties;
        }

        return properties;
    }

    isDashboardInstalled(cluster): boolean {
        let clusterCustomProperties = this.getClusterCustomProperties(cluster);
        if (!clusterCustomProperties) {
            return false;
        }

        let nodeLink = cluster.nodeLinks[0];
        let installed =
            Utils.getCustomPropertyValue(cluster.nodes[nodeLink].customProperties, '__dashboardInstalled');

        return installed === "true";
    }

    openDashboard(cluster) {
        event.stopPropagation();

        if (!this.isDashboardInstalled(cluster)) {
            return;
        }

        let properties = cluster.nodes[cluster.nodeLinks[0]].customProperties;
        let dashboardLink = Utils.getCustomPropertyValue(properties, '__dashboardLink');
        if (dashboardLink) {
            window.open(dashboardLink);
        }
    }

    deleteCluster(event, cluster) {
        this.clusterToDelete = cluster;
        event.stopPropagation();
        // clear selection
        this.selectedItem = null;

        return false; // prevents navigation
    }

    deleteConfirmed() {
        this.service.delete(this.clusterToDelete.documentSelfLink, this.projectLink)
            .then(() => {
            this.clusterToDelete = null;

            this.gridView.refresh();
        }).catch(err => {
            this.deleteConfirmationAlert = Utils.getErrorMessage(err)._generic;
        });
    }

    deleteCanceled() {
        this.clusterToDelete = null;
    }

    nodeCount(cluster) {
        if (cluster) {
            var nodesString = Utils.getCustomPropertyValue(this.getClusterCustomProperties(cluster), '__nodes');
            if (nodesString) {
                return JSON.parse(nodesString).length;
            }
        }

        return I18n.t('notAvailable');
    }

    clusterState(cluster) {
        return I18n.t('clusters.state.' + cluster.status);
    }

    formatNumber(number) {
        if (!number) {
            return '0';
        }
        let m = Utils.getMagnitude(number);
        return Utils.formatBytes(number, m) + ' ' + Utils.magnitudes[m];
    }

    getResourceLabel(b1, b2, unit) {
        if (b2 == 0) {
            return 'N/A';
        }

        let m = Utils.getMagnitude(b2);
        return Utils.formatBytes(b1, m) + ' of ' + Utils.formatBytes(b2, m)
                + Utils.magnitudes[m] + unit;
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

        if (!this.hasNodes(cluster)) {
            return;
        }

        var hostLink = cluster.nodeLinks[0];

        this.service.patch(hostLink, {'powerState': Constants.hosts.state.ON}, this.projectLink)
            .then(() => {

                this.gridView.refresh();
        }).catch((err) => {
            console.log(Utils.getErrorMessage(err)._generic);
        });

        return false; // prevents navigation
    }

    disableHost(event, cluster) {
        event.stopPropagation();

        if (!this.hasNodes(cluster)) {
            return;
        }

        var hostLink = cluster.nodeLinks[0];

        this.service.patch(hostLink, {'powerState': Constants.hosts.state.SUSPEND}, this.projectLink)
            .then(() => {

                this.gridView.refresh();
        }).catch((err) => {
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
