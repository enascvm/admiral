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

package com.vmware.admiral.auth;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.fail;

import static com.vmware.admiral.auth.util.PrincipalUtil.encode;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import java.util.stream.Collectors;

import org.apache.commons.io.IOUtils;
import org.junit.Before;

import com.vmware.admiral.auth.idm.AuthConfigProvider;
import com.vmware.admiral.auth.idm.Principal;
import com.vmware.admiral.auth.idm.PrincipalService;
import com.vmware.admiral.auth.idm.SecurityContext;
import com.vmware.admiral.auth.idm.SecurityContext.SecurityContextPostDto;
import com.vmware.admiral.auth.idm.SessionService;
import com.vmware.admiral.auth.idm.content.AuthContentService;
import com.vmware.admiral.auth.idm.content.AuthContentService.AuthContentBody;
import com.vmware.admiral.auth.idm.local.LocalAuthConfigProvider.Config;
import com.vmware.admiral.auth.idm.local.LocalPrincipalService.LocalPrincipalState;
import com.vmware.admiral.auth.project.ProjectFactoryService;
import com.vmware.admiral.auth.project.ProjectService;
import com.vmware.admiral.auth.project.ProjectService.ExpandedProjectState;
import com.vmware.admiral.auth.project.ProjectService.ProjectState;
import com.vmware.admiral.auth.util.AuthUtil;
import com.vmware.admiral.auth.util.ProjectUtil;
import com.vmware.admiral.common.test.BaseTestCase;
import com.vmware.admiral.host.HostInitAuthServiceConfig;
import com.vmware.admiral.host.HostInitCommonServiceConfig;
import com.vmware.admiral.host.HostInitComputeServicesConfig;
import com.vmware.admiral.host.HostInitPhotonModelServiceConfig;
import com.vmware.admiral.service.common.AuthBootstrapService;
import com.vmware.admiral.service.common.harbor.HostInitHarborServices;
import com.vmware.xenon.common.CommandLineArgumentParser;
import com.vmware.xenon.common.DeferredResult;
import com.vmware.xenon.common.Operation;
import com.vmware.xenon.common.Operation.AuthorizationContext;
import com.vmware.xenon.common.Service;
import com.vmware.xenon.common.Service.Action;
import com.vmware.xenon.common.StatelessService;
import com.vmware.xenon.common.UriUtils;
import com.vmware.xenon.common.Utils;
import com.vmware.xenon.common.test.TestContext;
import com.vmware.xenon.common.test.VerificationHost;
import com.vmware.xenon.services.common.UserGroupService;
import com.vmware.xenon.services.common.UserGroupService.UserGroupState;
import com.vmware.xenon.services.common.UserService.UserState;

public abstract class AuthBaseTest extends BaseTestCase {
    protected static final String USER_EMAIL_ADMIN = "fritz@admiral.com";
    protected static final String USER_EMAIL_ADMIN2 = "administrator@admiral.com";
    protected static final String USER_EMAIL_CLOUD_ADMIN = "cloud-admin@admiral.com";
    protected static final String USER_EMAIL_BASIC_USER = "tony@admiral.com";
    protected static final String USER_EMAIL_GLORIA = "gloria@admiral.com";
    protected static final String USER_EMAIL_CONNIE = "connie@admiral.com";

    protected static final String USER_EMAIL_PROJECT_ADMIN_1 = "project-admin-1@admiral.com";
    protected static final String USER_EMAIL_PROJECT_MEMBER_1 = "project-member-1@admiral.com";
    protected static final String USER_EMAIL_PROJECT_VIEWER_1 = "project-viewer-1@admiral.com";

    protected static final String USER_NAME_ADMIN = "Fritz";
    protected static final String USER_NAME_ADMIN2 = "Administrator";
    protected static final String USER_NAME_BASIC_USER = "Tony";
    protected static final String USER_NAME_GLORIA = "Gloria";
    protected static final String USER_NAME_CONNIE = "Connie";

    protected static final String USER_GROUP_SUPERUSERS = "superusers@admiral.com";
    protected static final String USER_GROUP_DEVELOPERS = "developers@admiral.com";

    public static final int DEFAULT_WAIT_SECONDS_FOR_AUTH_SERVICES = 180;

    protected static final String PROJECT_NAME_TEST_PROJECT_1 = "test.project1";
    protected static final String PROJECT_NAME_TEST_PROJECT_2 = "test.project2";
    protected static final String PROJECT_NAME_TEST_PROJECT_3 = "test.project3";

    protected static final String FILE_AUTH_CONTENT_DEFAULT = "auth-content.json";
    protected static final String FILE_AUTH_CONTENT_PROJECTS_ONLY = "content-projects-only.json";

    private static final String FILE_LOCAL_USERS = "/local-users.json";

    protected static final String EXPECTED_ILLEGAL_ACCESS_ERROR_MESSAGE = "Should've thrown IllegalAccessError!";
    protected static final String FORBIDDEN = "forbidden";

    protected List<String> loadedUsers;
    protected List<String> loadedGroups;

    protected class TestService extends StatelessService {
        public static final String SELF_LINK = "/test/service/";
    }

    public static class PrivilegedTestService extends StatelessService {
        public static final String SELF_LINK = "/test/privileged-service/";

        public PrivilegedTestService() {
            super();
        }
    }

    protected Service testService;
    protected Service privilegedTestService;

    @Before
    public void beforeForAuthBase() throws Throwable {
        host.setSystemAuthorizationContext();

        startServices(host);

        waitForServiceAvailability(AuthInitialBootService.SELF_LINK);
        waitForInitialBootServiceToBeSelfStopped(AuthInitialBootService.SELF_LINK);
        waitForDefaultRoles();
        waitForDefaultUsersAndGroups();
        TestContext ctx = new TestContext(1,
                Duration.ofSeconds(DEFAULT_WAIT_SECONDS_FOR_AUTH_SERVICES));
        AuthUtil.getPreferredProvider(AuthConfigProvider.class).waitForInitBootConfig(host,
                ((CustomizationVerificationHost) host).localUsers,
                ctx::completeIteration, ctx::failIteration);
        ctx.await();

        privilegedTestService = host.startServiceAndWait(PrivilegedTestService.class,
                PrivilegedTestService.SELF_LINK);

        host.resetAuthorizationContext();

        testService = new TestService();
        testService.setSelfLink(TestService.SELF_LINK);
        testService.setHost(host);
    }

    @Override
    protected VerificationHost createHost() throws Throwable {
        String[] customArgs = {
                CommandLineArgumentParser.ARGUMENT_PREFIX
                        + AuthUtil.LOCAL_USERS_FILE
                        + CommandLineArgumentParser.ARGUMENT_ASSIGNMENT
                        + AuthBaseTest.class.getResource(FILE_LOCAL_USERS).toURI().getPath()
        };
        return createHost(customArgs);
    }

    @Override
    protected void setPrivilegedServices(VerificationHost host) {
        host.addPrivilegedService(SessionService.class);
        host.addPrivilegedService(PrincipalService.class);
        host.addPrivilegedService(ProjectService.class);
        host.addPrivilegedService(ProjectFactoryService.class);
        host.addPrivilegedService(PrivilegedTestService.class);
    }

    protected Operation createAuthorizedOperation(AuthorizationContext authorizationContext) {
        Operation op = Operation.createGet(UriUtils.buildUri("http://localhost/foo/bar"));
        privilegedTestService.setAuthorizationContext(op, authorizationContext);
        return op;
    }

    protected void startServices(VerificationHost host) throws Throwable {
        HostInitCommonServiceConfig.startServices(host);
        HostInitPhotonModelServiceConfig.startServices(host);
        HostInitComputeServicesConfig.startServices(host, true);
        HostInitAuthServiceConfig.startServices(host);
        HostInitHarborServices.startServices(host, true);

        host.registerForServiceAvailability(AuthBootstrapService.startTask(host), true,
                AuthBootstrapService.FACTORY_LINK);
    }

    protected ProjectState createProject(String name) throws Throwable {
        return createProject(name, null, false, null, null, null);
    }

    protected ProjectState createProject(String name, Map<String, String> customProperties)
            throws Throwable {
        return createProject(name, null, false, null, null, null, customProperties);
    }

    protected ProjectState createProject(String name, String description, boolean isPublic)
            throws Throwable {
        return createProject(name, description, isPublic, null, null, null);
    }

    protected ProjectState createProject(String name, String description, boolean isPublic,
            Map<String, String> customProperties) throws Throwable {
        return createProject(name, description, isPublic, null, null, null, customProperties);
    }

    protected ProjectState createProject(String name, String description, boolean isPublic,
            String adminsGroupLink, String membersGroupLink, String viewersGroupLink)
            throws Throwable {
        return createProject(name, description, isPublic, adminsGroupLink, membersGroupLink,
                viewersGroupLink, null);
    }

    protected ProjectState createProject(String name, String description, boolean isPublic,
            String adminsGroupLink, String membersGroupLink, String viewersGroupLink,
            Map<String, String> customProperties)
            throws Throwable {
        ProjectState projectState = new ProjectState();

        projectState.id = UUID.randomUUID().toString();
        projectState.name = name;
        projectState.description = description;
        projectState.isPublic = isPublic;
        projectState.customProperties = customProperties;

        if (adminsGroupLink != null) {
            projectState.administratorsUserGroupLinks = new HashSet<>();
            projectState.administratorsUserGroupLinks.add(adminsGroupLink);
        }
        if (membersGroupLink != null) {
            projectState.membersUserGroupLinks = new HashSet<>();
            projectState.membersUserGroupLinks.add(membersGroupLink);
        }
        if (viewersGroupLink != null) {
            projectState.viewersUserGroupLinks = new HashSet<>();
            projectState.viewersUserGroupLinks.add(viewersGroupLink);
        }

        projectState = doPost(projectState, ProjectFactoryService.SELF_LINK);

        return projectState;
    }

    protected ProjectState createProjectExpectFailure(String name) throws Throwable {
        ProjectState state = new ProjectState();
        state.name = name;
        state = doOperation(state, UriUtils.buildUri(host, ProjectFactoryService.SELF_LINK),
                ProjectState.class, true, Action.POST);
        return state;
    }

    protected ProjectState patchProject(ProjectState patchState, String projectSelfLink)
            throws Throwable {
        ProjectState patchedState = doPatch(patchState, projectSelfLink);

        return patchedState;
    }

    protected ProjectState updateProject(ProjectState updateState) throws Throwable {
        ProjectState updatedProject = doPut(updateState);

        return updatedProject;
    }

    protected void deleteProject(ProjectState projectToBeDeleted) throws Throwable {
        URI projectUri = UriUtils.buildUri(host, projectToBeDeleted.documentSelfLink);

        doDelete(projectUri, false);
    }

    protected String getProjectLinkByName(String projectName) throws Throwable {
        ProjectState project = getProjectByName(projectName);
        return project == null ? null : project.documentSelfLink;
    }

    protected ProjectState getProjectByName(String projectName) throws Throwable {
        List<ProjectState> projects = getDocumentsOfType(ProjectState.class);
        return projects.stream()
                .filter(project -> project.name.equals(projectName))
                .findFirst()
                .orElse(null);
    }

    protected void verifyDocumentAccessible(String documentLink, String userEmail,
            boolean expectAccessible) throws Throwable {
        host.assumeIdentity(buildUserServicePath(userEmail));
        try {
            Object result = getDocument(Object.class, documentLink);
            if (!expectAccessible) {
                String error = String.format("%s must not be able to access %s", userEmail,
                        documentLink);
                host.log(Level.SEVERE, error);
                throw new IllegalStateException(error);
            } else {
                assertNotNull(result);
            }
        } catch (IllegalAccessError e) {
            if (expectAccessible) {
                String error = String.format("%s must be able to access %s", userEmail,
                        documentLink);
                host.log(Level.SEVERE, error);
                throw new IllegalStateException(error, e);
            }
        }
    }

    protected void verifyExceptionMessage(String expected, String message) {
        if (!expected.equals(message)) {
            String errorMessage = String.format("Expected error '%s' but was '%s'", expected,
                    message);
            throw new IllegalStateException(errorMessage);
        }
    }

    @Override
    protected void doPatch(Object state, String documentSelfLink) {
        TestContext ctx = testCreate(1);
        Operation patch = Operation.createPatch(host, documentSelfLink)
                .setBody(state)
                .setReferer(host.getUri())
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    ctx.completeIteration();
                });
        host.send(patch);
        ctx.await();
    }

    private void loadLocalUsers() {
        String localUsers = AuthUtil.getLocalUsersFile(host);
        assertNotNull(localUsers);
        Config config;
        try {
            String content = new String(Files.readAllBytes((new File(localUsers)).toPath()));
            config = Utils.fromJson(content, Config.class);
        } catch (Exception e) {
            fail(String.format("Failed to load users configuration file '%s'!. Error: %s",
                    localUsers, Utils.toString(e)));
            return;

        }

        if (config.users == null || config.users.isEmpty()) {
            fail("No users found in the configuration file!");
            return;
        }

        loadedUsers = config.users.stream()
                .map((u) -> u.email)
                .collect(Collectors.toList());

        loadedGroups = config.groups.stream()
                .map(u -> u.name)
                .collect(Collectors.toList());
    }

    private void waitForDefaultRoles() throws Throwable {
        waitForServiceAvailability(AuthUtil.CLOUD_ADMINS_RESOURCE_GROUP_LINK,
                AuthUtil.CLOUD_ADMINS_USER_GROUP_LINK,
                AuthUtil.DEFAULT_CLOUD_ADMINS_ROLE_LINK,
                AuthUtil.DEFAULT_BASIC_USERS_ROLE_LINK,
                AuthUtil.BASIC_USERS_USER_GROUP_LINK,
                AuthUtil.BASIC_USERS_RESOURCE_GROUP_LINK);
    }

    private void waitForDefaultUsersAndGroups() throws Throwable {
        loadLocalUsers();
        waitFor(() -> {
            List<String> stateLinks = getDocumentLinksOfType(LocalPrincipalState.class);
            int expectedSize = loadedUsers.size() + loadedGroups.size();
            if (stateLinks == null || stateLinks.isEmpty()
                    || stateLinks.size() != expectedSize) {
                return false;
            }
            return true;
        });
    }

    protected List<UserState> getUsersFromUserGroup(String userGroupLink) throws Throwable {
        UserGroupState state = getDocument(UserGroupState.class, userGroupLink);
        assertNotNull(state);
        assertNotNull(state.query);

        DeferredResult<List<UserState>> result = ProjectUtil
                .retrieveUserStatesForGroup(testService, state);

        List<UserState> resultList = new ArrayList<>();

        TestContext ctx = testCreate(1);

        result.whenComplete((list, ex) -> {
            if (ex != null) {
                ctx.failIteration(ex);
                return;
            }
            resultList.addAll(list);
            ctx.completeIteration();
        });
        ctx.await();
        return resultList;
    }

    protected void loadAuthContent(String authContentFilename) throws Throwable {
        // read the configuration content from the specified file
        String content = IOUtils
                .toString(getClass().getClassLoader().getResource(authContentFilename));
        loadAuthContent(Utils.fromJson(content, AuthContentBody.class));
    }

    protected void loadAuthContent(AuthContentBody authContent) throws Throwable {
        // prepate loading operation
        Operation loadContent = Operation.createPost(host, AuthContentService.SELF_LINK)
                .setReferer(host.getUri())
                .setBody(authContent)
                .setCompletion((o, e) -> {
                    if (e != null) {
                        host.failIteration(e);
                    } else {
                        host.completeIteration();
                    }
                });

        // ensure the AuthContentService is up
        waitForServiceAvailability(AuthContentService.SELF_LINK);

        // load the configuration
        host.testStart(1);
        host.send(loadContent);
        host.testWait();
    }

    protected DeferredResult<SecurityContext> getSecurityContextFromSessionService() {
        return host.sendWithDeferredResult(Operation.createGet(host, SessionService.SELF_LINK),
                SecurityContext.class);
    }

    protected SecurityContext getSecurityContext() {
        final SecurityContext[] context = new SecurityContext[1];
        TestContext ctx = testCreate(1);
        host.send(Operation.createGet(host, SessionService.SELF_LINK)
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    context[0] = o.getBody(SecurityContext.class);
                    ctx.completeIteration();
                }));
        ctx.await();
        return context[0];
    }

    protected SecurityContext getSecurityContext(String principalId) {
        final SecurityContext[] context = new SecurityContext[1];
        TestContext ctx = testCreate(1);
        host.send(Operation.createGet(host, UriUtils.buildUriPath(PrincipalService.SELF_LINK,
                principalId, PrincipalService.SECURITY_CONTEXT_SUFFIX))
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    context[0] = o.getBody(SecurityContext.class);
                    ctx.completeIteration();
                }));
        ctx.await();
        return context[0];
    }

    protected SecurityContext getSecurityContextByCredentials(String principalId, String password) {
        SecurityContextPostDto dto = new SecurityContextPostDto();
        dto.password = password;

        final SecurityContext[] result = new SecurityContext[1];
        TestContext ctx = testCreate(1);
        Operation post = Operation
                .createPost(host, UriUtils.buildUriPath(PrincipalService.SELF_LINK, principalId,
                        PrincipalService.SECURITY_CONTEXT_SUFFIX))
                .setBody(dto)
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    result[0] = o.getBody(SecurityContext.class);
                    ctx.completeIteration();
                });
        host.send(post);
        ctx.await();
        return result[0];
    }

    protected ExpandedProjectState getExpandedProjectState(String projectLink) {
        URI uriWithExpand = UriUtils.extendUriWithQuery(UriUtils.buildUri(host, projectLink),
                UriUtils.URI_PARAM_ODATA_EXPAND, Boolean.toString(true));

        ExpandedProjectState resultState = new ExpandedProjectState();
        host.testStart(1);
        Operation.createGet(uriWithExpand)
                .setReferer(host.getUri())
                .setCompletion((o, e) -> {
                    if (e != null) {
                        host.failIteration(e);
                    } else {
                        ExpandedProjectState retrievedState = o
                                .getBody(ExpandedProjectState.class);
                        retrievedState.copyTo(resultState);
                        host.completeIteration();
                    }
                }).sendWith(host);
        host.testWait();
        return resultState;
    }

    protected Principal getPrincipal(String principalId) {
        final Principal[] principal = new Principal[1];
        TestContext ctx = testCreate(1);
        Operation getPrincipal = Operation
                .createGet(host, UriUtils.buildUriPath(PrincipalService.SELF_LINK, principalId))
                .setReferer(host.getUri())
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    principal[0] = o.getBody(Principal.class);
                    ctx.completeIteration();
                });
        host.send(getPrincipal);
        ctx.await();
        return principal[0];
    }

    public void deleteUser(String user) {
        TestContext ctx = testCreate(1);

        Operation delete = Operation.createDelete(host, AuthUtil
                .buildUserServicePathFromPrincipalId(user))
                .setReferer(host.getUri())
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    ctx.completeIteration();
                });
        host.send(delete);
        ctx.await();
    }

    public void deleteUserGroup(String userGroup) {
        TestContext ctx = testCreate(1);

        Operation delete = Operation
                .createDelete(host, UriUtils.buildUriPath(UserGroupService.FACTORY_LINK, userGroup))
                .setReferer(host.getUri())
                .setCompletion((o, ex) -> {
                    if (ex != null) {
                        ctx.failIteration(ex);
                        return;
                    }
                    ctx.completeIteration();
                });
        host.send(delete);
        ctx.await();
    }

    protected String buildUserServicePath(String email) {
        return AuthUtil.buildUserServicePathFromPrincipalId(encode(email));
    }
}
