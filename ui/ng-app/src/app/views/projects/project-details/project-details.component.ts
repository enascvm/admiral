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
import { ActivatedRoute, Router } from '@angular/router';
import { BaseDetailsComponent } from '../../../components/base/base-details.component';
import { AuthService } from '../../../utils/auth.service';
import { DocumentService } from '../../../utils/document.service';
import { ErrorService } from "../../../utils/error.service";
import { FT } from '../../../utils/ft';
import { Links } from '../../../utils/links';
import { Roles } from '../../../utils/roles';
import { RoutesRestriction } from '../../../utils/routes-restriction';
import { Utils } from '../../../utils/utils';

const TAB_ID_SUMMARY = "summary";
const TAB_ID_MEMBERS = "members";
const TAB_ID_REPOSITORIES = "hbrRepo";
const TAB_ID_INFRASTRUCTURE = "infra";
const TAB_ID_REGISTRIES = "registries";
const TAB_ID_REPLICATION = "replication";
const TAB_ID_CONFIGURATION = "config";

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.scss']
})
/**
 * Project Details tabbed view.
 */
export class ProjectDetailsComponent extends BaseDetailsComponent {
    hbrProjectId;
    hbrSessionInfo = {};
    isHbrEnabled = FT.isHbrEnabled();
    userSecurityContext: any;

    constructor(route: ActivatedRoute, service: DocumentService, router: Router,
                private authService: AuthService, errorService: ErrorService) {
        super(Links.PROJECTS, route, router, service, errorService);

        if (!this.embedded) {
            this.authService.getCachedSecurityContext().then((securityContext) => {
                this.userSecurityContext = securityContext;
            }).catch((error) => {
                this.errorService.error(Utils.getErrorMessage(error)._generic);
            });
        }

        this.supportedTabs = [TAB_ID_SUMMARY, TAB_ID_MEMBERS, TAB_ID_REPOSITORIES,
            TAB_ID_INFRASTRUCTURE, TAB_ID_REGISTRIES, TAB_ID_REPLICATION, TAB_ID_CONFIGURATION];
    }

    get projectName(): string {
      return (this.entity && this.entity.name) || 'unknown';
    }

    protected entityInitialized() {
        let cs = this.entity.customProperties || {};
        if (cs.__projectIndex) {
            this.hbrProjectId = parseInt(cs.__projectIndex);
        }
    }

    get isActiveTabSummary(): boolean {
        return this.isActiveTab(TAB_ID_SUMMARY);
    }

    summaryTabActivated($event) {
        this.tabActivated($event, TAB_ID_SUMMARY);
    }

    get isActiveTabMembers(): boolean {
        return this.isActiveTab(TAB_ID_MEMBERS);
    }

    membersTabActivated($event) {
        this.tabActivated($event, TAB_ID_MEMBERS);
    }

    get isActiveTabRepositories(): boolean {
        return this.isActiveTab(TAB_ID_REPOSITORIES);
    }

    repositoriesTabActivated($event) {
        this.tabActivated($event, TAB_ID_REPOSITORIES);
    }

    get isActiveTabInfrastructure(): boolean {
        return this.isActiveTab(TAB_ID_INFRASTRUCTURE);
    }

    infrastructureTabActivated($event) {
        this.tabActivated($event, TAB_ID_INFRASTRUCTURE);
    }

    get isActiveTabRegistries(): boolean {
        return this.isActiveTab(TAB_ID_REGISTRIES);
    }

    registriesTabActivated($event) {
        this.tabActivated($event, TAB_ID_REGISTRIES);
    }

    get isActiveTabReplication() {
        return this.isActiveTab(TAB_ID_REPLICATION);
    }

    replicationTabActivated($event) {
        this.tabActivated($event, TAB_ID_REPLICATION);
    }

    get isActiveTabConfig() {
        return this.isActiveTab(TAB_ID_CONFIGURATION);
    }

    configTabActivated($event) {
        this.tabActivated($event, TAB_ID_CONFIGURATION);
    }

    watchRepoClickEvent(repositoryItem) {
        this.router.navigate(['repositories', repositoryItem.name], { relativeTo: this.route });
    }

    reloadProject(project: any) {
        if (project) {
          this.entity = project;
      }
    }

    private navigateToRegistries() {
        this.tabActivated(true, TAB_ID_REGISTRIES);
    }

    get hasProjectAdminRole(): boolean {
        return Utils.isAccessAllowed(this.userSecurityContext, this.admiralProjectSelfLink,
                                [Roles.CLOUD_ADMIN, Roles.PROJECT_ADMIN]);
    }

    get admiralProjectSelfLink() {
        return this.entity && this.entity.documentSelfLink;
    }

    get projectsByIdRouteRestriction() {
        return RoutesRestriction.PROJECTS_ID;
    }

    get hasAccessToRegistryReplication() {
        return Utils.isAccessAllowed(this.userSecurityContext, this.admiralProjectSelfLink,
                                                RoutesRestriction.PROJECT_REGISTRY_REPLICATION);
    }

    get embedded(): boolean {
        return FT.isApplicationEmbedded();
    }
}
