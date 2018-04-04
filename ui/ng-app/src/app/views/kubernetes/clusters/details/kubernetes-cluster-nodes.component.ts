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

import { Component, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AutoRefreshComponent } from "../../../../components/base/auto-refresh.component";
import { DocumentService } from "../../../../utils/document.service";
import { FT } from '../../../../utils/ft';
import { Utils } from "../../../../utils/utils";

@Component({
    selector: 'app-kubernetes-cluster-nodes',
    templateUrl: './kubernetes-cluster-nodes.component.html',
    styleUrls: ['./kubernetes-cluster-nodes.component.scss']
})
/**
*  A k8s cluster nodes view.
*/
export class KubernetesClusterNodesComponent {
    @Input() cluster: any;

    constructor(private service: DocumentService) {}
}
