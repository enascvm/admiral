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

import { Component, OnInit } from '@angular/core';
import { DocumentListResult, DocumentService } from "../../utils/document.service";
import { ErrorService } from "../../utils/error.service";
import { Constants } from "../../utils/constants";
import { Links } from "../../utils/links";
import { CancelablePromise, Utils} from "../../utils/utils";
import { RoutesRestriction } from '../../utils/routes-restriction';

@Component({
    selector: 'app-endpoints',
    templateUrl: './endpoints.component.html',
    styleUrls: ['./endpoints.component.scss']
})
/**
 * Main view for Endpoints.
 */
export class EndpointsComponent implements OnInit {
    loading: boolean;
    loadingPromise: CancelablePromise<DocumentListResult>;

    endpoints: any[];
    selectedEndpoints: any[] = [];

    showDeleteConfirmation: boolean = false;
    deleteConfirmationAlert: string;

    // alert
    alertMessage: string;
    alertType: string;

    // Creation
    constructor(protected service: DocumentService, private errorService: ErrorService) {
        //
    }

    ngOnInit() {
        this.listEndpoints({});
    }

    listEndpoints(queryOptions) {
        if (this.loadingPromise) {
            this.loadingPromise.cancel();
        }

        this.loading = true;

        this.loadingPromise = new CancelablePromise(this.service.list(
            Links.PKS_ENDPOINTS, queryOptions, undefined, true));
        this.loadingPromise.getPromise().then(result => {
            this.loading = false;

            this.endpoints = result.documents;
        }).catch(error => {
            this.loading = false;

            if (error) {
                if (error.isCanceled) {
                    // ok to be canceled
                } else {
                    console.error('Failed loading endpoints ', error);
                    this.showErrorMessage(error);
                }
            }
        })
    }

    refreshEndpoints($event?) {
        this.listEndpoints($event && $event.queryOptions || {});
    }

    removeSelectedEndpoints($event) {
        $event.stopPropagation();

        this.showDeleteConfirmation = true;
    }

    deleteConfirmed() {
        let promises: any[] = [];

        this.selectedEndpoints.forEach((endpointToDelete) => {
           let deletePromise =  this.service.delete(endpointToDelete.documentSelfLink);
           promises.push(deletePromise);
        });

        Promise.all(promises).then(() => {
            this.selectedEndpoints = [];

            this.showDeleteConfirmation = false;
            this.refreshEndpoints();
        }).catch(err => {
            this.deleteConfirmationAlert = Utils.getErrorMessage(err)._generic;
        });
    }

    deleteCanceled() {
        this.showDeleteConfirmation = false;
    }

    private showErrorMessage(error) {
        this.alertType = Constants.alert.type.DANGER;
        this.alertMessage = Utils.getErrorMessage(error)._generic;
    }

    resetAlert() {
        this.alertType = null;
        this.alertMessage = null;
    }

    get endpointsNewRouteRestriction() {
        return RoutesRestriction.ENDPOINTS_NEW_VRA;
    }

    get endpointsRemoveRouteRestriction() {
        return RoutesRestriction.ENDPOINTS_REMOVE_VRA;
    }
}
