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

import { Pipe, PipeTransform } from '@angular/core';
import { FT } from './ft';

@Pipe({ name: 'projectName' })
export class ProjectNamePipe implements PipeTransform {
  public transform(project: any): string | any | any[] {
    if (!project) {
      return '--';
    }
    return FT.isApplicationEmbedded() && !FT.isVca() ? project.label : project.name;
  }
}
