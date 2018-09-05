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

import { Component, ViewChild, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentService } from '../../utils/document.service';
import { ErrorService } from '../../utils/error.service';
import { ProjectService } from '../../utils/project.service';
import { GridViewComponent } from '../../components/grid-view/grid-view.component';
import { AutoRefreshComponent } from '../../components/base/auto-refresh.component';
import { RoutesRestriction } from '../../utils/routes-restriction';
import { Constants } from '../../utils/constants';
import { FT } from '../../utils/ft';
import { Links } from '../../utils/links';
import { Utils } from '../../utils/utils';

import * as I18n from 'i18next';

@Component({
    selector: 'app-clusters',
    templateUrl: './clusters.component.html',
    styleUrls: ['./clusters.component.scss']
})
/**
 * Clusters main grid view.
 */
export class ClustersComponent extends AutoRefreshComponent {
    @Input() hideTitle: boolean = false;
    @Input() projectLink: string;
    @Input() tabId: string = '';

    @ViewChild('gridView') gridView: GridViewComponent;

    serviceEndpoint = FT.isPksEnabled() ?  Links.CLUSTERS + '?type=!KUBERNETES' : Links.CLUSTERS;
    clusterToDelete: any;
    deleteConfirmationAlert: string;

    selectedItem: any;

    hostEventsSubscriptionAllowed: boolean = FT.allowHostEventsSubscription();

    constructor(protected route: ActivatedRoute, protected router: Router,
                protected service: DocumentService, protected projectService: ProjectService,
                protected errorService: ErrorService) {

        super(router, route, FT.allowHostEventsSubscription(),
              Utils.getClustersViewRefreshInterval(), true);

        Utils.subscribeForProjectChange(projectService, (changedProjectLink) => {
            this.projectLink = changedProjectLink;
        });
    }

    ngOnInit(): void {
        this.refreshFnCallScope = this.gridView;
        this.refreshFn = this.gridView.autoRefresh;

        var me = this;
        this.gridView.processItemsFn = function(itemsValue) {
            let processedItems = itemsValue.map(itemVal => {
                if (me.hostEventsSubscriptionAllowed) {
                    itemVal.supportsOperationRescan = true;
                }
                if (me.isVchOperationSupported('ENABLE', itemVal)) {
                    itemVal.supportsOperationEnable = true;
                }
                if (me.isVchOperationSupported('DISABLE', itemVal)) {
                    itemVal.supportsOperationDisable = true;
                }

                return itemVal;
            });

            return processedItems;
        };

        super.ngOnInit();
    }

    get deleteConfirmationDescription(): string {
        if (FT.isVic()) {
            return this.clusterToDelete && this.clusterToDelete.name
                && I18n.t('clusters.delete.confirmationVic', {
                    clusterName: this.clusterToDelete.name,
                    interpolation: {escapeValue: false}
                } as I18n.TranslationOptions);
        }
        return this.clusterToDelete && this.clusterToDelete.name
            && I18n.t('clusters.delete.confirmation', {
                clusterName: this.clusterToDelete.name,
                interpolation: {escapeValue: false}
            } as I18n.TranslationOptions);
    }

    get deleteTitle() {
        if (FT.isVic()) {
            return this.clusterToDelete && this.clusterToDelete.name
                && I18n.t('clusters.delete.titleVic');
        }
        return this.clusterToDelete && this.clusterToDelete.name
            && I18n.t('clusters.delete.title');
    }

    get title() {
        if (FT.isVic()) {
            return I18n.t('clusters.titleVic');
        }
        return I18n.t('clusters.title');
    }

    get createButtonText() {
        if (FT.isVic()) {
            return I18n.t('clusters.newVic');
        }
        return I18n.t('clusters.new');
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
        .then(result => {
            this.clusterToDelete = null;
            this.gridView.refresh();
        })
        .catch(err => {
            this.deleteConfirmationAlert = Utils.getErrorMessage(err)._generic;
        });
    }

    deleteCanceled() {
        this.clusterToDelete = null;
    }

    rescanCluster(event, cluster) {
        event.stopPropagation();
        // clear selection
        this.selectedItem = null;

        this.service.get(cluster.documentSelfLink + '/hosts')
        .then((clusterHostsResult) => {
            this.gridView.refresh();

            let computeContainerHostLinks = [];

            if (FT.isApplicationEmbedded()) {
                clusterHostsResult.content.forEach(element => {
                    computeContainerHostLinks.push(element.documentSelfLink);
                });
            } else {
                computeContainerHostLinks = clusterHostsResult.documentLinks;
            }

            let clusterHostsLinks = {
                computeContainerHostLinks: computeContainerHostLinks
            };
            // start hosts data collection
            this.service.patch(Links.HOST_DATA_COLLECTION, clusterHostsLinks, this.projectLink)
            .then((response) => {
                Utils.repeat(this, this.refreshCluster, [cluster],
                    Utils.getClusterRescanRetriesNumber(), Utils.getClusterRescanInterval());
            }).catch(error => {
                console.error('Rescan of cluster failed', Utils.getErrorMessage(error)._generic);
                this.errorService.error(Utils.getErrorMessage(error)._generic);
            });

        }).catch(error => {
            console.error('Cannot retrieve cluster resources',
                                                            Utils.getErrorMessage(error)._generic);
            this.errorService.error(Utils.getErrorMessage(error)._generic);
        });

        return false; // prevents navigation
    }

    disableVchCluster(event, cluster) {
        event.stopPropagation();

        this.patchVchClusterPowerState(cluster, Constants.hosts.state.SUSPEND);
    }

    enableVchCluster(event, cluster) {
        event.stopPropagation();

        this.patchVchClusterPowerState(cluster, Constants.hosts.state.ON);
    }

    patchVchClusterPowerState(cluster, powerState) {
        if (!cluster.nodeLinks || cluster.nodeLinks.length < 1) {
            return;
        }

        var vchHostLink = cluster.nodeLinks[0];

        this.service.patch(vchHostLink, {'powerState': powerState})
        .then(result => {
            this.gridView.refresh();
        })
        .catch(error => {
            console.log(Utils.getErrorMessage(error)._generic);
            this.errorService.error(Utils.getErrorMessage(error)._generic);
        });
    }

    isVchOperationSupported(op, cluster): boolean {
        if (!cluster || cluster.type !== 'VCH') {
            return;
        }

        if (op === 'ENABLE') {
            return cluster.status === Constants.clusters.status.DISABLED;
        } else if (op === 'DISABLE') {
            return cluster.status === Constants.clusters.status.ON;
        }

        return false;
    }

    refreshCluster(cluster) {
        this.service.get(cluster.documentSelfLink).then((updatedCluster) => {
            // update cluster information
            cluster.status = updatedCluster.status;
            cluster.containerCount = updatedCluster.containerCount;
            cluster.totalMemory = updatedCluster.totalMemory;
            cluster.memoryUsage = updatedCluster.memoryUsage;
            cluster.nodeLinks = updatedCluster.nodeLinks;
            cluster.nodes = updatedCluster.nodes;
            cluster.totalCpu = updatedCluster.totalCpu;
            cluster.cpuUsage = updatedCluster.cpuUsage;
            // TODO more fields?
        }).catch(error => {
            console.error('Cannot refresh cluster information',
                Utils.getErrorMessage(error)._generic);
            this.errorService.error(Utils.getErrorMessage(error)._generic);
        });
    }

    cpuPercentageLevel(cluster) {
        if (!cluster) {
            return 0;
        }
        return Math.floor(cluster.cpuUsage / cluster.totalCpu * 100);
    }

    memoryPercentageLevel(cluster) {
        if (!cluster) {
            return 0;
        }
        return Math.floor(cluster.memoryUsage / cluster.totalMemory * 100);
    }

    getResourceLabel(b1, b2, unit) {
        if (b2 == 0) {
            return 'N/A';
        }

        let m = Utils.getMagnitude(b2);
        return Utils.formatBytes(b1, m) + ' of ' + Utils.formatBytes(b2, m)
                + Utils.magnitudes[m] + unit;
    }

    clusterState(cluster) {
        return I18n.t('clusters.state.' + cluster.status);
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

    get clustersNewRouteRestrictions() {
        return RoutesRestriction.CLUSTERS_NEW;
    }

    get clustersCardViewActions() {
        return RoutesRestriction.CLUSTERS_ID;
    }

}
