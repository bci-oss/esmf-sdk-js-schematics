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

import {Schema} from '../schema';
import {dasherize} from '@angular-devkit/core/src/utils/strings';

export class TsDirectiveGenerator {
    static generateResizeDirective(options: Schema): string {
        return `
        /** ${options.templateHelper.getGenerationDisclaimerText()} **/ 
        import {Directive, ElementRef, EventEmitter, Inject, Input, OnInit, Output, Renderer2} from '@angular/core';
        import {DOCUMENT} from '@angular/common';
        
        @Directive({
            selector: '[resizeColumn]',
        })
        export class ResizeColumnDirective implements OnInit {
        
            @Input('resizeColumn') resizable: boolean = false;
            @Input() index: number = 0;
        
            @Output() dragging = new EventEmitter<any>();
        
            private startX!: number;
            private startWidth!: number;
            private readonly column!: HTMLElement;
            private table!: HTMLElement;
            private pressed!: boolean;
            private tableCells!: HTMLElement[];
            private handle!: HTMLElement;
        
            private mouseMoveListener!: () => void;
            private mouseUpListener!: () => void;
            private mouseEnterListener!: () => void;
            private mouseLeaveListener!: () => void;
        
            constructor(private renderer: Renderer2, private el: ElementRef, @Inject(DOCUMENT) private document: Document) {
                this.column = this.el.nativeElement;
            }
        
            ngOnInit() {
                if (this.resizable) {
                    this.setTable();
                    this.setListeners();
                    this.createHandle();
                }
            }
        
            createHandle(): void {
                this.handle = this.renderer.createElement('div');
                this.renderer.appendChild(this.column, this.handle);
                this.renderer.addClass(this.handle, 'handle');
            }
        
            setTable(): void {
                const row = this.renderer.parentNode(this.column);
                const thead = this.renderer.parentNode(row);
                this.table = this.renderer.parentNode(thead);
            }
        
            setListeners(): void {
                this.mouseEnterListener = this.renderer.listen(this.column, 'mouseenter', this.onMouseEnter);
                this.mouseLeaveListener = this.renderer.listen(this.column, 'mouseleave', this.onMouseLeave);
            }
        
            onMouseEnter = (): void => {
                this.renderer.setStyle(this.handle, 'opacity', '1');
                this.renderer.listen(this.handle, 'mousedown', this.onMouseDown);
            };
        
        
            onMouseLeave = (): void => {
                this.renderer.setStyle(this.handle, 'opacity', '0');
            };
        
            onMouseDown = (event: MouseEvent) => {
                this.pressed = true;
                this.mouseEnterListener();
                this.mouseLeaveListener();
                this.dragging.emit(true);
                this.startX = event.pageX;
                this.startWidth = this.column.offsetWidth;
                this.renderer.addClass(this.document.body, 'resizing');
                this.tableCells = Array.from(this.table.querySelectorAll('.mat-row')).map((row: any) =>
                    row.querySelectorAll('.mat-cell').item(this.index)
                );
                this.mouseMoveListener = this.renderer.listen(this.table, 'mousemove', this.onMouseMove);
                this.mouseUpListener = this.renderer.listen('document', 'mouseup', this.onMouseUp);
        
            };
        
            onMouseMove = (event: MouseEvent): void => {
                const offset = 35;
                if (this.pressed && event.buttons) {
                    // Calculate width of column
                    let width = this.startWidth + (event.pageX - this.startX - offset);
        
                    // Set table header width
                    this.renderer.setStyle(this.column, 'width', \`\${width}px\`);
        
                    // Set table cells width
                    for (const cell of this.tableCells) {
                        this.renderer.setStyle(cell, 'width', \`\${width}px\`);
                    }
                }
            };
        
            onMouseUp = (): void => {
                if (this.pressed) {
                    this.renderer.removeClass(this.document.body, 'resizing');
                    this.renderer.setStyle(this.handle, 'opacity', '0');
                    this.mouseMoveListener();
                    this.mouseUpListener();
                    this.setListeners();
                    this.pressed = false;
        
                    // setTimeout is used in order to ensure that the click will only trigger the resize event and not the
                    // sorting one as well, since both of the events are triggered on the same cell. This is the only way it
                    // worked. If you have another idea, please feel free to change it.
                    setTimeout((): void => {
                        this.dragging.emit(false);
                    }, 0);
                }
            };
        }
        `;
    }

    static generateValidateInputDirective(options: Schema): string {
        const hasSearchFilter = options.templateHelper.isAddCommandBarFunctionSearch(options.enabledCommandBarFunctions);
        return `
        /** ${options.templateHelper.getGenerationDisclaimerText()} **/ 
        import {Directive, Input} from '@angular/core';
        import {
            AbstractControl,
            FormControl,
            FormGroupDirective,
            NgForm,
            NG_VALIDATORS,
            ValidationErrors,
            ValidatorFn
        } from '@angular/forms';
        import {ErrorStateMatcher} from '@angular/material/core';
        ${
            hasSearchFilter
                ? `import {SearchField} from '../components/${dasherize(options.name)}/v${options.templateHelper.formatAspectModelVersion(
                      options.aspectModelVersion
                  )}/${dasherize(options.name)}.filter.service';`
                : ``
        }
        
        @Directive({
            selector: '[validateInput]',
            providers: [
                {
                    provide: NG_VALIDATORS,
                    multi: true,
                    useExisting: ValidateInputDirective,
                },
            ],
        })
        export class ValidateInputDirective {
            /** Pass here the regex pattern as string, e.g. '^[a-zA-Z0-9-_.,+ ]+$' */
            @Input() validateInput: string = '';
            ${
                hasSearchFilter
                    ? `
            @Input() stringColumns: SearchField[] = [];
            @Input() selectedStringColumns: string[] = [];
            `
                    : ``
            }
        
            validate(control: AbstractControl): ValidationErrors | null {
                return validateInputsValidator(new RegExp(this.validateInput))(control) 
                ${hasSearchFilter ? `|| validateStringColumns(this.selectedStringColumns, this.stringColumns)(control)` : `;`}
            }
        }
        
        export class ValidationErrorStateMatcher implements ErrorStateMatcher {
            isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
                return !!((control && control.invalid && control.touched) || control?.dirty);
            }
        }
        
        function validateInputsValidator(pattern: RegExp): ValidatorFn {
            return (control: AbstractControl): ValidationErrors | null => {
                const value = control.value;
                const allowedCharacters = pattern;
        
                //trigger error if input has blank space
                if (value?.indexOf(' ') === 0 || value?.endsWith(' ')) {
                    return {blankSpace: true};
                }
        
                //allow input to be empty
                if (value?.length === 0) {
                    return null;
                }
        
                //trigger error if input does not meet the pattern criteria
                if (value?.length > 0 && !value?.match(allowedCharacters)) {
                    return {invalidInput: true};
                }
        
                return null;
            };
        }
        
        ${
            hasSearchFilter
                ? `
        function validateStringColumns(selectedStringColumns: string[] | undefined, stringColumns: SearchField[]): ValidatorFn {
            return (): ValidationErrors | null => {
                selectedStringColumns = stringColumns
                    .filter((col: SearchField): boolean => col.selected)
                    .map((col: SearchField): string => col.columnName)
                    .filter((columnName: string) => !!columnName);
        
                return selectedStringColumns.length ? null : {emptyStringColumnsArray: true};
            };
        } 
        `
                : ``
        }
    `;
    }

    static generateHorizontalOverflowDirective(options: Schema): string {
        return `
        /** ${options.templateHelper.getGenerationDisclaimerText()} **/ 
        import {AfterContentInit, Directive, ElementRef, HostListener, Input, NgZone, OnDestroy} from '@angular/core';
        import {MatChipList} from '@angular/material/chips';
        import {Subject} from 'rxjs';
        import {take, takeUntil} from 'rxjs/operators';
        
        @Directive({
            selector: '[horizontalOverflow]',
            exportAs: 'horizontalOverflow'
        })
        export class HorizontalOverflowDirective implements AfterContentInit, OnDestroy {
            @Input('chipsObj') chips!: MatChipList;
        
            private readonly _destroyed$ = new Subject<void>();
            disableLeftBtn: boolean = true;
            disableRightBtn: boolean = true;
            left: number = 0;
            offsetWidth: number = 0;
            scrollWidth: number = 0;
            clientWidth: number = 0;
            scrollable: boolean = false;
            scrollValue: number = 200;
        
            constructor(private element: ElementRef, private zone: NgZone) {
            }
        
            ngAfterContentInit() {
                this.chips.chips.changes.pipe(takeUntil(this._destroyed$)).subscribe(() =>
                    this.zone.onStable
                        .asObservable()
                        .pipe(take(1))
                        .subscribe(() => {
                            this.adjustValues()
                        })
                );
            }
        
            @HostListener("wheel", ["$event"])
            public onScroll(event: WheelEvent) {
                let [x, y] = [event.deltaX, event.deltaY];
                let magnitude;
        
                if (x === 0) {
                    magnitude = y > 0 ? this.scrollValue : -this.scrollValue;
                } else {
                    magnitude = x;
                }
        
                this.element.nativeElement.scrollBy({
                    left: magnitude,
                    behavior: 'smooth'
                });
            }
        
            @HostListener('scroll') onScrollEvent(): void {
                this.adjustValues();
            }
        
            adjustValues(): void {
                this.left = this.element.nativeElement.scrollLeft;
                this.offsetWidth = this.element.nativeElement.offsetWidth;
                this.scrollWidth = this.element.nativeElement.scrollWidth;
                this.clientWidth = this.element.nativeElement.clientWidth;
                this.disableLeftBtn = this.left === 0;
                this.disableRightBtn = this.left >= this.scrollWidth - this.offsetWidth - 1;
                this.scrollable = this.scrollWidth > this.clientWidth;
            }
        
            scrollChipList(direction: string): void {
                switch (direction) {
                    case 'left':
                        this.element.nativeElement.scrollLeft -= this.scrollValue;
                        break;
                    case 'right':
                        this.element.nativeElement.scrollLeft += this.scrollValue;
                        break;
        
                }
            }
        
            ngOnDestroy() {
                this._destroyed$.next();
                this._destroyed$.complete();
            }
        }
        `;
    }
}