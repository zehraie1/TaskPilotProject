import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page.ts';
import { TaskForm } from './task-form.ts';
import { STATUS_LABEL, type TaskStatus } from '../utils/test-data.ts';

export type SortOption = 'Recently updated' | 'Newest created' | 'Due date' | 'Title A–Z' | 'Highest priority';

/** /tasks — task table with search, status filter, sort, pagination and row actions. */
export class TasksPage extends BasePage {
  readonly createButton: Locator;
  readonly search: Locator;
  readonly statusFilter: Locator;
  readonly sort: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyState: Locator;
  readonly paginationSummary: Locator;
  readonly form: TaskForm;

  constructor(page: Page) {
    super(page);
    this.createButton = page.getByTestId('create-task');
    this.search = page.getByTestId('search-tasks');
    this.statusFilter = page.getByTestId('status-filter');
    this.sort = page.getByTestId('sort-tasks');
    this.table = page.getByRole('main').getByRole('table');
    this.rows = this.table.getByRole('rowgroup').nth(1).getByRole('row');
    this.emptyState = page.getByRole('main').getByText('No matching tasks');
    this.paginationSummary = page.getByRole('main').getByText(/^Showing \d+–\d+ of \d+ tasks$/);
    this.form = new TaskForm(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/tasks');
    await expect(this.heading).toHaveText('Tasks');
    await this.waitForLoaded();
  }

  /** Row for an exact task title (matched through its unique "Edit <title>" action). */
  row(title: string): Locator {
    return this.rows.filter({ has: this.page.getByRole('button', { name: `Edit ${title}`, exact: true }) });
  }

  rowStatus(title: string): Locator {
    return this.row(title).getByRole('combobox', { name: `Change status for ${title}` });
  }

  /** Narrow the table to one task. Unique titles make this deterministic on a shared database. */
  async searchFor(text: string): Promise<void> {
    await this.search.fill(text);
    await this.waitForLoaded();
  }

  async filterByStatus(status: TaskStatus | 'all'): Promise<void> {
    await this.statusFilter.selectOption(status === 'all' ? { label: 'All statuses' } : { label: STATUS_LABEL[status] });
    await this.waitForLoaded();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sort.selectOption({ label: option });
    await this.waitForLoaded();
  }

  async openCreateForm(): Promise<TaskForm> {
    await this.createButton.click();
    await this.form.expectOpen('Create task');
    return this.form;
  }

  async openEditForm(title: string): Promise<TaskForm> {
    await this.row(title).getByRole('button', { name: `Edit ${title}`, exact: true }).click();
    await this.form.expectOpen('Edit task');
    return this.form;
  }

  async openDetails(title: string): Promise<void> {
    await this.row(title).getByRole('link', { name: `View ${title}`, exact: true }).click();
  }

  async changeStatus(title: string, status: TaskStatus): Promise<void> {
    await this.rowStatus(title).selectOption(status);
  }

  /** Delete through the row action. TaskPilot asks for confirmation with a native window.confirm(). */
  async deleteTask(title: string, confirm = true): Promise<string> {
    const dialogMessage = new Promise<string>((resolve) => {
      this.page.once('dialog', async (dialog) => {
        resolve(dialog.message());
        await (confirm ? dialog.accept() : dialog.dismiss());
      });
    });
    await this.row(title).getByRole('button', { name: `Delete ${title}`, exact: true }).click();
    return dialogMessage;
  }

  async expectTaskVisible(title: string): Promise<void> {
    await expect(this.row(title)).toHaveCount(1);
  }

  async expectTaskAbsent(title: string): Promise<void> {
    await expect(this.row(title)).toHaveCount(0);
  }

  async expectRowStatus(title: string, status: TaskStatus): Promise<void> {
    await expect(this.rowStatus(title)).toHaveValue(status);
  }
}
