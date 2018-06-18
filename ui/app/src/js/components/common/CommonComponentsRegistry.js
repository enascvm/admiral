/*
 * Copyright (c) 2016-2018 VMware, Inc. All Rights Reserved.
 *
 * This product is licensed to you under the Apache License, Version 2.0 (the "License").
 * You may not use this product except in compliance with the License.
 *
 * This product may include a number of subcomponents with separate copyright notices
 * and license terms. Your use of these subcomponents is subject to the terms and
 * conditions of the subcomponent's license, as noted in the LICENSE file.
 */

/**
 * Helper class that imports the common Vue components, so that they can be used without need for
 * imports in other Vue components.
 * Internally when components are imported for the first time they register as Vue components.
 * */

/* eslint-disable */

import GridSearch from 'components/common/GridSearch';
import VueGridSearchTag from 'components/common/VueGridSearchTag';
import VueSearch from 'components/common/VueSearch';
import VueRefreshButton from 'components/common/VueRefreshButton';
import ListTitle from 'components/common/ListTitle';
import ListTitleBig from 'components/common/ListTitleBig';
import VueTitleActionButton from 'components/common/VueTitleActionButton';
import VueTimeoutAlert from 'components/common/VueTimeoutAlert';
import VueActionConfirmation from 'components/common/VueActionConfirmation';
import VueDropdown from 'components/common/VueDropdown';
import VueDropdownGroup from 'components/common/VueDropdownGroup';
import VueDropdownSearch from 'components/common/VueDropdownSearch';
import VueDropdownSearchGroup from 'components/common/VueDropdownSearchGroup';
import VueMultiColumnEditor from 'components/common/VueMultiColumnEditor';
import VueMultiColumnEditorGroup from 'components/common/VueMultiColumnEditorGroup';
import VueCheckboxControl from 'components/common/VueCheckboxControl';
import VueCheckboxGroup from 'components/common/VueCheckboxGroup';
import VueInputControl from 'components/common/VueInputControl';
import VueInputGroup from 'components/common/VueInputGroup';
import VueSelectControl from 'components/common/VueSelectControl';
import VueSelectGroup from 'components/common/VueSelectGroup';
import VueTypeaheadControl from 'components/common/VueTypeaheadControl';
import VueActionButton from 'components/common/VueActionButton';
import VueBigActionButton from 'components/common/VueBigActionButton';
import VueNavigationLink from 'components/common/VueNavigationLink';
import VueTableHeaderSort from 'components/common/VueTableHeaderSort';
import VueGrid from 'components/common/VueGrid';
import VueAlert from 'components/common/VueAlert';
import ContextSidePanelToolbarItem from 'components/ContextSidePanelToolbarItem';
import ContextSidePanel from 'components/ContextSidePanel';
import VueDeleteItemConfirmation from 'components/common/VueDeleteItemConfirmation';
import VueModal from 'components/common/VueModal';
import SideNavigation from 'components/common/SideNavigation';
import VueClrIconClose from 'components/common/VueClrIconClose';
import RequestGraph from 'components/requests/RequestGraph';
import DocsHelp from 'components/common/DocsHelp';
