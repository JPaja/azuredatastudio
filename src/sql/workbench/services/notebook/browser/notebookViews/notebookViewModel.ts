/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { INotebookView, INotebookViewCell } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { generateUuid } from 'vs/base/common/uuid';

export const DEFAULT_VIEW_CARD_HEIGHT = 4;
export const DEFAULT_VIEW_CARD_WIDTH = 12;
export const GRID_COLUMNS = 12;

export class ViewNameTakenError extends Error { }

function cellCollides(c1: INotebookViewCell, c2: INotebookViewCell): boolean {
	return !((c1.y + c1.height <= c2.y) || (c1.x + c1.width <= c2.x) || (c1.x + c1.width <= c2.x) || (c2.x + c2.width <= c1.x));
}

export class NotebookViewModel implements INotebookView {
	private _onDeleted = new Emitter<INotebookView>();
	private _isNew: boolean = false;

	public readonly guid: string;
	public readonly onDeleted = this._onDeleted.event;

	constructor(
		protected _name: string,
		private _notebookViews: NotebookViewsExtension,
		guid?: string
	) {
		this.guid = generateUuid();
	}

	public initialize(): void {
		this._isNew = true;
		const cells = this._notebookViews.notebook.cells;
		cells.forEach((cell, idx) => { this.initializeCell(cell, idx); });
	}

	protected initializeCell(cell: ICellModel, idx: number) {
		let meta = this._notebookViews.getCellMetadata(cell);

		if (!meta) {
			this._notebookViews.initializeCell(cell);
			meta = this._notebookViews.getCellMetadata(cell);
		}

		meta.views.push({
			guid: this.guid,
			hidden: false,
			y: idx * DEFAULT_VIEW_CARD_HEIGHT,
			x: 0,
			width: DEFAULT_VIEW_CARD_WIDTH,
			height: DEFAULT_VIEW_CARD_HEIGHT
		});
	}

	public get name(): string {
		return this._name;
	}

	public set name(name: string) {
		if (this.name !== name && this._notebookViews.viewNameIsTaken(name)) {
			throw new ViewNameTakenError(localize('notebookView.nameTaken', 'A view with the name {0} already exists in this notebook.', name));
		}
		this._name = name;
	}

	public nameAvailable(name: string): boolean {
		return !this._notebookViews.viewNameIsTaken(name);
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCell {
		const meta = this._notebookViews.getCellMetadata(cell);
		return meta?.views?.find(view => view.guid === this.guid);
	}

	public get hiddenCells(): Readonly<ICellModel[]> {
		return this.cells.filter(cell => this.getCellMetadata(cell)?.hidden);
	}

	public get cells(): Readonly<ICellModel[]> {
		return this._notebookViews.notebook.cells;
	}

	public get displayedCells(): Readonly<ICellModel[]> {
		return this.cells.filter(cell => !this.getCellMetadata(cell)?.hidden);
	}

	public getCell(guid: string): Readonly<ICellModel> {
		return this._notebookViews.notebook.cells.find(cell => cell.cellGuid === guid);
	}

	public insertCell(cell: ICellModel) {
		this._notebookViews.updateCell(cell, this, { hidden: false });
	}

	public hideCell(cell: ICellModel) {
		this._notebookViews.updateCell(cell, this, { hidden: true });
	}

	public moveCell(cell: ICellModel, x: number, y: number) {
		this._notebookViews.updateCell(cell, this, { x, y });
	}

	public resizeCell(cell: ICellModel, width?: number, height?: number) {
		let data: INotebookViewCell = {};

		if (width) {
			data.width = width;
		}

		if (height) {
			data.height = height;
		}

		this._notebookViews.updateCell(cell, this, data);
	}

	public getCellSize(cell: ICellModel): any {
		const meta = this.getCellMetadata(cell);
		return { width: meta.width, height: meta.height };
	}

	public compactCells() {
		let cellsPlaced: INotebookViewCell[] = [];

		this.displayedCells.forEach((cell: ICellModel) => {
			const c1 = this.getCellMetadata(cell);

			for (let i = 0; ; i++) {
				const row = i % GRID_COLUMNS;
				const column = Math.floor(i / GRID_COLUMNS);

				if (row + c1.width > GRID_COLUMNS) {
					continue;
				}

				if (!cellsPlaced.find((c2) => cellCollides(c2, { ...c1, x: row, y: column }))) {
					this._notebookViews.updateCell(cell, this, { x: row, y: column });
					cellsPlaced.push({ ...c1, x: row, y: column });
					break;
				}
			}
		});
	}

	public save() {
		this._notebookViews.commit();
	}

	public delete() {
		this._notebookViews.removeView(this.guid);
		this._onDeleted.fire(this);
	}

	public get isNew(): boolean {
		return this._isNew;
	}

	public markAsViewed() {
		this._isNew = false;
	}

	public toJSON() {
		return { guid: this.guid, name: this._name } as NotebookViewModel;
	}
}
