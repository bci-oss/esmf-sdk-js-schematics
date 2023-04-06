/*
 * Copyright (c) 2023 Robert Bosch Manufacturing Solutions GmbH
 *
 * See the AUTHORS file(s) distributed with this work for
 * additional information regarding authorship.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

import {Rule, SchematicContext, SchematicsException, Tree} from '@angular-devkit/schematics';
import {
    addDeclarationToModule,
    addExportToModule,
    addModuleImportToModule,
    buildComponent,
    findModuleFromOptions,
    parseSourceFile,
} from '@angular/cdk/schematics';
import * as ts from 'typescript';
import {ModuleOptions} from '@schematics/angular/utility/find-module';
import {Schema} from '../ng-generate/table/schema';
import {dasherize} from '@angular-devkit/core/src/utils/strings';
import {InsertChange} from "@schematics/angular/utility/change";

declare interface ModuleDefinition {
    name: string;
    fromLib: string;
}

declare interface SkipHandler {
    skip(): boolean;
}

export function addToComponentModule(skipImport: SkipHandler | boolean, options: Schema, modules: Array<ModuleDefinition> = []): Rule {
    return (tree: Tree) => {
        if (skipImport !== undefined && (skipImport === true || (skipImport !== false && (skipImport as SkipHandler).skip()))) {
            return;
        }
        const componentModuleFile = `${options.path}/${dasherize(options.name)}.module.ts`;
        const moduleFileEntry = tree.get(componentModuleFile);
        if (moduleFileEntry !== null) {
            modules.forEach(moduleDef => {
                addModuleImportToModule(tree, moduleFileEntry.path, moduleDef.name, moduleDef.fromLib);
            });
        } else {
            throw new Error(`Module ${componentModuleFile}.`);
        }
    };
}

export function addToAppModule(modules: Array<ModuleDefinition> = [], skipImport: SkipHandler | boolean): Rule {
    const appModule: ModuleOptions = {name: 'AppModule', module: 'app.module.ts', path: '/src/app'};
    return addToModule(appModule, modules, skipImport);
}

export function addToAppSharedModule(modules: Array<ModuleDefinition> = [], skipImport: SkipHandler | boolean): Rule {
    const appModule: ModuleOptions = {name: 'AppSharedModule', module: 'app-shared.module.ts', path: '/src/app/shared'};
    return addToModule(appModule, modules, skipImport);
}

function addToModule(appModule: ModuleOptions, modules: Array<ModuleDefinition> = [], skipImport: SkipHandler | boolean): Rule {
    return async (tree: Tree) => {
        if (skipImport !== undefined && (skipImport === true || (skipImport !== false && (skipImport as SkipHandler).skip()))) {
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const modulePath = (await findModuleFromOptions(tree, appModule))!;
        modules.forEach(moduleDef => {
            addModuleImportToModule(tree, modulePath, moduleDef.name, moduleDef.fromLib);
        });
    };
}

export async function addToDeclarationsArray(
    options: Schema,
    tree: Tree,
    declarationName: string,
    declarationPath: string,
    modulePath?: string
): Promise<Tree> {
    modulePath = modulePath || (await findModuleFromOptions(tree, options)) || '';
    const sourceFile = parseSourceFile(tree, modulePath);
    const declarationChanges = addDeclarationToModule(sourceFile, modulePath, declarationName, declarationPath);
    const declarationRecorder = tree.beginUpdate(modulePath);

    for (const change of declarationChanges) {
        if (change.constructor.name === 'InsertChange') {
            declarationRecorder.insertLeft((change as InsertChange).pos, (change as InsertChange).toAdd);
        }
    }
    tree.commitUpdate(declarationRecorder);

    return tree;
}

export async function addToExportsArray(
    options: Schema,
    tree: Tree,
    exportName: string,
    exportPath: string,
    modulePath?: string
): Promise<Tree> {
    modulePath = modulePath || (await findModuleFromOptions(tree, options)) || '';
    const sourceFile = parseSourceFile(tree, modulePath);
    const exportChanges = addExportToModule(sourceFile, modulePath, exportName, exportPath);
    const exportRecorder = tree.beginUpdate(modulePath);

    for (const change of exportChanges) {
        if (change.constructor.name === 'InsertChange') {
            exportRecorder.insertLeft((change as InsertChange).pos, (change as InsertChange).toAdd);
        }
    }
    tree.commitUpdate(exportRecorder);

    return tree;
}

export function getSourceFile(host: Tree, path: string): ts.SourceFile {
    const buffer = host.read(path);
    if (!buffer) {
        throw new SchematicsException(`Could not read file (${path}).`);
    }
    const content = buffer.toString();
    return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
}

// wrap the execution to avoid raise conditions e.g. the path will
// be changed from relative to absolut ('src/..' -> '/src/..') which
// forces to the error with prettier that no files are found.
// add options for module and flat to ensure correct import path
export function wrapBuildComponentExecution(options: Schema): Rule {
    return async (tree: Tree, context: SchematicContext) => {
        options.module = options.module || 'app.module';
        options.flat = true;
        return buildComponent(Object.assign({}, options));
    };
}