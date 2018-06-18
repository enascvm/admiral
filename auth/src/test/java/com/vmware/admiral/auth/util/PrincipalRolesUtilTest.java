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

package com.vmware.admiral.auth.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import static com.vmware.admiral.auth.util.PrincipalUtil.encode;

import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.Test;

import com.vmware.admiral.auth.AuthBaseTest;
import com.vmware.admiral.auth.idm.AuthRole;
import com.vmware.admiral.auth.idm.Principal;
import com.vmware.admiral.auth.idm.PrincipalRoles;
import com.vmware.admiral.auth.idm.PrincipalRolesHandler.PrincipalRoleAssignment;
import com.vmware.admiral.auth.idm.PrincipalService;
import com.vmware.admiral.auth.idm.SecurityContext;
import com.vmware.admiral.auth.idm.SecurityContext.ProjectEntry;
import com.vmware.admiral.auth.idm.local.LocalPrincipalFactoryService;
import com.vmware.admiral.auth.idm.local.LocalPrincipalService.LocalPrincipalState;
import com.vmware.admiral.auth.idm.local.LocalPrincipalService.LocalPrincipalType;
import com.vmware.admiral.auth.project.ProjectFactoryService;
import com.vmware.admiral.auth.project.ProjectRolesHandler.ProjectRoles;
import com.vmware.admiral.auth.project.ProjectService.ProjectState;
import com.vmware.xenon.common.DeferredResult;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.common.test.TestContext;

public class PrincipalRolesUtilTest extends AuthBaseTest {

    @Test
    public void testGetDirectlyAssignedSystemRoles() throws GeneralSecurityException {
        // Verify for cloud admin.
        host.assumeIdentity(buildUserServicePath(USER_EMAIL_ADMIN));

        DeferredResult<Set<AuthRole>> result = PrincipalRolesUtil
                .getDirectlyAssignedSystemRolesForUser(privilegedTestService,
                        getPrincipal(USER_EMAIL_ADMIN));

        Set<AuthRole> roles = new HashSet<>();
        TestContext ctx = testCreate(1);
        result.whenComplete((rolesResult, ex) -> {
            if (ex != null) {
                ctx.failIteration(ex);
                return;
            }
            roles.addAll(rolesResult);
            ctx.completeIteration();
        });
        ctx.await();

        assertTrue(roles.contains(AuthRole.CLOUD_ADMIN));
        assertTrue(roles.contains(AuthRole.BASIC_USER));
        assertTrue(roles.contains(AuthRole.BASIC_USER_EXTENDED));

        // Verify for basic user.
        result = PrincipalRolesUtil.getDirectlyAssignedSystemRolesForUser(privilegedTestService,
                getPrincipal(USER_EMAIL_BASIC_USER));
        Set<AuthRole> roles1 = new HashSet<>();
        TestContext ctx1 = testCreate(1);
        result.whenComplete((rolesResult, ex) -> {
            if (ex != null) {
                ctx1.failIteration(ex);
                return;
            }
            roles1.addAll(rolesResult);
            ctx1.completeIteration();
        });
        ctx1.await();

        assertTrue(roles1.contains(AuthRole.BASIC_USER));
        assertTrue(roles1.contains(AuthRole.BASIC_USER_EXTENDED));
    }

    @Test
    public void testGetDirectlyAssignedProjectRoles() throws Throwable {
        host.assumeIdentity(buildUserServicePath(USER_EMAIL_ADMIN));
        ProjectState project = new ProjectState();
        project.name = "test";
        project.description = "test-description";
        project = doPost(project, ProjectFactoryService.SELF_LINK);
        assertNotNull(project.documentSelfLink);

        PrincipalRoleAssignment roleAssignment = new PrincipalRoleAssignment();
        roleAssignment.add = Collections.singletonList(USER_EMAIL_ADMIN);
        ProjectRoles projectRoles = new ProjectRoles();
        projectRoles.viewers = roleAssignment;
        projectRoles.members = roleAssignment;
        projectRoles.administrators = roleAssignment;
        doPatch(projectRoles, project.documentSelfLink);

        DeferredResult<List<ProjectEntry>> result = PrincipalRolesUtil
                .getDirectlyAssignedProjectRolesForUser(privilegedTestService,
                        getPrincipal(USER_EMAIL_ADMIN));

        TestContext ctx = testCreate(1);
        List<ProjectEntry> entries = new ArrayList<>();
        result.whenComplete((resultEntries, ex) -> {
            if (ex != null) {
                ctx.failIteration(ex);
                return;
            }
            entries.addAll(resultEntries);
            ctx.completeIteration();
        });
        ctx.await();

        assertEquals(1, entries.size());
        assertEquals(project.name, entries.get(0).name);
        assertEquals(project.documentSelfLink, entries.get(0).documentSelfLink);
        assertTrue(entries.get(0).roles.contains(AuthRole.PROJECT_ADMIN));
        assertTrue(entries.get(0).roles.contains(AuthRole.PROJECT_MEMBER));
        assertTrue(entries.get(0).roles.contains(AuthRole.PROJECT_VIEWER));
    }

    @Test
    public void testGetAllRolesForPrincipal() throws Throwable {
        Operation testOperationByAdmin = createAuthorizedOperation(
                host.assumeIdentity(buildUserServicePath(USER_EMAIL_ADMIN2)));

        // Scenario: create 2 projects, assign fritz as project admin in 1st and as project
        // member in 2nd project.

        // Create first project and assign fritz as project admin.
        ProjectState firstProject = createProject("first-project");
        assertNotNull(firstProject.documentSelfLink);
        ProjectRoles projectRoles = new ProjectRoles();
        PrincipalRoleAssignment admins = new PrincipalRoleAssignment();
        admins.add = Collections.singletonList(USER_EMAIL_ADMIN);
        projectRoles.administrators = admins;
        doPatch(projectRoles, firstProject.documentSelfLink);

        // Create second project and assign fritz as project member.
        ProjectState secondProject = createProject("second-project");
        assertNotNull(secondProject.documentSelfLink);
        projectRoles = new ProjectRoles();
        PrincipalRoleAssignment members = new PrincipalRoleAssignment();
        members.add = Collections.singletonList(USER_EMAIL_ADMIN);
        projectRoles.members = members;
        doPatch(projectRoles, secondProject.documentSelfLink);

        Principal fritz = getPrincipal(USER_EMAIL_ADMIN);
        DeferredResult<PrincipalRoles> result = PrincipalRolesUtil.getAllRolesForPrincipal(
                privilegedTestService, testOperationByAdmin, fritz);

        final PrincipalRoles[] resultRoles = new PrincipalRoles[1];

        TestContext ctx = testCreate(1);
        result.whenComplete((principalRoles, ex) -> {
            if (ex != null) {
                ctx.failIteration(ex);
                return;
            }
            resultRoles[0] = principalRoles;
            ctx.completeIteration();
        });
        ctx.await();

        PrincipalRoles fritzRoles = resultRoles[0];

        assertNotNull(fritzRoles.email);
        assertNotNull(fritzRoles.id);
        assertNotNull(fritzRoles.name);
        assertNotNull(fritzRoles.type);
        assertNotNull(fritzRoles.roles);
        assertNotNull(fritzRoles.projects);

        assertTrue(fritzRoles.roles.contains(AuthRole.CLOUD_ADMIN));
        assertTrue(fritzRoles.roles.contains(AuthRole.BASIC_USER));
        assertTrue(fritzRoles.roles.contains(AuthRole.BASIC_USER_EXTENDED));

        assertEquals(2, fritzRoles.projects.size());

        ProjectEntry firstProjectEntry;
        ProjectEntry secondProjectEntry;

        if (fritzRoles.projects.get(0).name.equalsIgnoreCase(firstProject.name)) {
            firstProjectEntry = fritzRoles.projects.get(0);
            secondProjectEntry = fritzRoles.projects.get(1);
        } else {
            firstProjectEntry = fritzRoles.projects.get(1);
            secondProjectEntry = fritzRoles.projects.get(0);
        }

        assertEquals(firstProject.name, firstProjectEntry.name);
        assertEquals(firstProject.documentSelfLink, firstProjectEntry.documentSelfLink);
        assertEquals(1, firstProjectEntry.roles.size());
        assertTrue(firstProjectEntry.roles.contains(AuthRole.PROJECT_ADMIN));

        assertEquals(secondProject.name, secondProjectEntry.name);
        assertEquals(secondProject.documentSelfLink, secondProjectEntry.documentSelfLink);
        assertEquals(2, secondProjectEntry.roles.size());
        assertTrue(secondProjectEntry.roles.contains(AuthRole.PROJECT_MEMBER));
    }

    @Test
    public void testGetAllRolesForPrincipalWithIndirectRoles() throws Throwable {
        Operation testOperationByAdmin = createAuthorizedOperation(
                host.assumeIdentity(buildUserServicePath(USER_EMAIL_ADMIN2)));

        // Scenario: create a group which will contain Connie which is basic user and the group
        // will be assigned to cloud admins. Create nested groups and add Connie in them, assign
        // the nested groups to project roles. Verify that PrincipalRoles for Connie contains all
        // roles where he is assigned indirectly.

        // root is the group where Connie belongs and we assign the group to cloud admins role.
        LocalPrincipalState root = new LocalPrincipalState();
        root.type = LocalPrincipalType.GROUP;
        root.name = "root@admiral.com";
        root.groupMembersLinks = Collections.singletonList(UriUtils.buildUriPath(
                LocalPrincipalFactoryService.SELF_LINK, encode(USER_EMAIL_CONNIE)));
        root = doPost(root, LocalPrincipalFactoryService.SELF_LINK);
        assertNotNull(root.documentSelfLink);

        // nestedGroup1 is the group where Connie belongs but we will add nestedGroup1 to
        // nestedGroup2 and we will indirectly assign roles to Connie as we assign a role to
        // nestedGroup2.
        LocalPrincipalState nestedGroup1 = new LocalPrincipalState();
        nestedGroup1.type = LocalPrincipalType.GROUP;
        nestedGroup1.name = "nestedGroup1@admiral.com";
        nestedGroup1.groupMembersLinks = Collections.singletonList(UriUtils.buildUriPath(
                LocalPrincipalFactoryService.SELF_LINK, encode(USER_EMAIL_CONNIE)));
        nestedGroup1 = doPost(nestedGroup1, LocalPrincipalFactoryService.SELF_LINK);
        assertNotNull(nestedGroup1.documentSelfLink);

        // nestedGroup2 is the group which contains nestedGroup1
        LocalPrincipalState nestedGroup2 = new LocalPrincipalState();
        nestedGroup2.type = LocalPrincipalType.GROUP;
        nestedGroup2.name = "nestedGroup2@admiral.com";
        nestedGroup2.groupMembersLinks = Collections.singletonList(nestedGroup1.documentSelfLink);
        nestedGroup2 = doPost(nestedGroup2, LocalPrincipalFactoryService.SELF_LINK);
        assertNotNull(nestedGroup2.documentSelfLink);

        // assign cloud admins role to root user group.
        PrincipalRoleAssignment roleAssignment = new PrincipalRoleAssignment();
        roleAssignment.add = Collections.singletonList(AuthRole.CLOUD_ADMIN.name());
        doPatch(roleAssignment, UriUtils.buildUriPath(PrincipalService.SELF_LINK, root.id,
                PrincipalService.ROLES_SUFFIX));

        // Create first project and assign nestedGroup1 as project admin.
        Map<String, String> customProperties = new HashMap<>();
        customProperties.put("key1", "value1");
        customProperties.put("key2", "value2");
        ProjectState firstProject = createProject("first-project", customProperties);
        assertNotNull(firstProject.documentSelfLink);
        ProjectRoles projectRoles = new ProjectRoles();
        PrincipalRoleAssignment admins = new PrincipalRoleAssignment();
        admins.add = Collections.singletonList(nestedGroup1.id);
        projectRoles.administrators = admins;
        doPatch(projectRoles, firstProject.documentSelfLink);

        // Create second project and assign nestedGroup2 as project member.
        ProjectState secondProject = createProject("second-project");
        assertNotNull(secondProject.documentSelfLink);
        projectRoles = new ProjectRoles();
        PrincipalRoleAssignment members = new PrincipalRoleAssignment();
        members.add = Collections.singletonList(nestedGroup2.id);
        projectRoles.members = members;
        doPatch(projectRoles, secondProject.documentSelfLink);

        Principal connie = getPrincipal(USER_EMAIL_CONNIE);
        DeferredResult<PrincipalRoles> result = PrincipalRolesUtil.getAllRolesForPrincipal(
                privilegedTestService, testOperationByAdmin, connie);

        final PrincipalRoles[] resultRoles = new PrincipalRoles[1];

        TestContext ctx = testCreate(1);
        result.whenComplete((principalRoles, ex) -> {
            if (ex != null) {
                ctx.failIteration(ex);
                return;
            }
            resultRoles[0] = principalRoles;
            ctx.completeIteration();
        });
        ctx.await();

        PrincipalRoles connieRoles = resultRoles[0];

        assertNotNull(connieRoles.email);
        assertNotNull(connieRoles.id);
        assertNotNull(connieRoles.name);
        assertNotNull(connieRoles.type);
        assertNotNull(connieRoles.roles);
        assertNotNull(connieRoles.projects);

        assertTrue(connieRoles.roles.contains(AuthRole.CLOUD_ADMIN));
        assertTrue(connieRoles.roles.contains(AuthRole.BASIC_USER));
        assertTrue(connieRoles.roles.contains(AuthRole.BASIC_USER_EXTENDED));

        assertEquals(2, connieRoles.projects.size());

        ProjectEntry firstProjectEntry;
        ProjectEntry secondProjectEntry;

        if (connieRoles.projects.get(0).name.equalsIgnoreCase(firstProject.name)) {
            firstProjectEntry = connieRoles.projects.get(0);
            secondProjectEntry = connieRoles.projects.get(1);
        } else {
            firstProjectEntry = connieRoles.projects.get(1);
            secondProjectEntry = connieRoles.projects.get(0);
        }

        assertEquals(firstProject.name, firstProjectEntry.name);
        assertEquals(firstProject.documentSelfLink, firstProjectEntry.documentSelfLink);
        assertEquals(1, firstProjectEntry.roles.size());
        assertTrue(firstProjectEntry.roles.contains(AuthRole.PROJECT_ADMIN));
        assertEquals(firstProject.customProperties, firstProjectEntry.customProperties);

        assertEquals(secondProject.name, secondProjectEntry.name);
        assertEquals(secondProject.documentSelfLink, secondProjectEntry.documentSelfLink);
        assertEquals(2, secondProjectEntry.roles.size());
        assertTrue(secondProjectEntry.roles.contains(AuthRole.PROJECT_MEMBER));
        assertEquals(secondProject.customProperties, secondProjectEntry.customProperties);
    }

    @Test
    public void testGetPrincipalRolesForBasicUser() throws GeneralSecurityException {
        Operation testOperationByAdmin = createAuthorizedOperation(
                host.assumeIdentity(buildUserServicePath(USER_EMAIL_ADMIN2)));

        Principal basicUser = getPrincipal(USER_EMAIL_BASIC_USER);
        DeferredResult<PrincipalRoles> result = PrincipalRolesUtil.getAllRolesForPrincipal(
                privilegedTestService, testOperationByAdmin, basicUser);

        final PrincipalRoles[] resultRoles = new PrincipalRoles[1];

        TestContext ctx = testCreate(1);
        result.whenComplete((principalRoles, ex) -> {
            if (ex != null) {
                ctx.failIteration(ex);
                return;
            }
            resultRoles[0] = principalRoles;
            ctx.completeIteration();
        });
        ctx.await();

        PrincipalRoles connieRoles = resultRoles[0];

        assertNotNull(connieRoles.email);
        assertNotNull(connieRoles.id);
        assertNotNull(connieRoles.name);
        assertNotNull(connieRoles.type);
        assertNotNull(connieRoles.roles);
        assertNotNull(connieRoles.projects);

        assertTrue(connieRoles.projects.isEmpty());
        assertEquals(2, connieRoles.roles.size());
        assertTrue(connieRoles.roles.contains(AuthRole.BASIC_USER));
        assertTrue(connieRoles.roles.contains(AuthRole.BASIC_USER_EXTENDED));
    }

    @Test
    public void testGetSecurityContextForPrincipalAssignedAsViewer() throws Throwable {
        host.assumeIdentity(buildUserServicePath(USER_EMAIL_ADMIN));
        ProjectRoles roles = new ProjectRoles();
        roles.viewers = new PrincipalRoleAssignment();
        roles.viewers.add = Collections.singletonList(USER_GROUP_DEVELOPERS);
        ProjectState testProject = createProject("test-project");
        assertNotNull(testProject.documentSelfLink);
        doPatch(roles, testProject.documentSelfLink);

        Operation getSecurityContext = Operation.createGet(host, UriUtils.buildUriPath(
                PrincipalService.SELF_LINK, USER_GROUP_DEVELOPERS, PrincipalService
                        .SECURITY_CONTEXT_SUFFIX));

        DeferredResult<SecurityContext> securityContextDr = host.sendWithDeferredResult(
                getSecurityContext, SecurityContext.class);

        final SecurityContext[] securityContext = new SecurityContext[1];
        TestContext ctx = testCreate(1);
        securityContextDr.whenComplete((sc, ex) -> {
            if (ex != null) {
                ctx.fail(ex);
                return;
            }
            securityContext[0] = sc;
            ctx.completeIteration();
        });
        ctx.await();

        assertEquals(1, securityContext[0].projects.size());
        ProjectEntry entry = securityContext[0].projects.get(0);
        assertEquals(testProject.name, entry.name);
        assertEquals(testProject.documentSelfLink, entry.documentSelfLink);
        assertTrue(securityContext[0].isProjectViewer(testProject.documentSelfLink));
    }
}
