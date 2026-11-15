import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page.ts';
import { TaskForm } from './task-form.ts';
import type { TaskStatus } from '../utils/test-data.ts';

/** /tasks/:taskId — single task view. */
export class TaskDetails extends BasePage {
  readonly backLink: Locator;
  readonly card: Locator;
  readonly title: Locator;
  readonly statusSelect: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly taskId: Locator;
  readonly form: TaskForm;

  constructor(page: Page) {
    super(page);
    this.backLink = page.getByRole('link', { name: 'Back to tasks' });
    this.card = page.getByRole('main').getByRole('article');
    this.title = this.card.getByRole('heading', { level: 1 });
    this.statusSelect = page.getByTestId('task-status');
    this.editButton = this.card.getByRole('button', { name: 'Edit', exact: true });
    this.deleteButton = page.getByTestId('delete-task-detail');
    this.taskId = this.card.getByRole('definition').first();
    this.form = new TaskForm(page);
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/tasks/${id}`);
    await this.waitForLoaded();
  }

  async expectLoaded(title: string): Promise<void> {
    await expect(this.title).toHaveText(title);
  }

  /** Value shown for a <dt>/<dd> pair such as "Task ID", "Created", "Updated". */
  field(term: 'Task ID' | 'Created' | 'Updated'): Locator {
    return this.card.getByRole('term').filter({ hasText: term }).locator('xpath=following-sibling::dd[1]');
  }

  async changeStatus(status: TaskStatus): Promise<void> {
    await this.statusSelect.selectOption(status);
  }

  async openEditForm(): Promise<TaskForm> {
    await this.editButton.click();
    await this.form.expectOpen('Edit task');
    return this.form;
  }

  async delete(confirm = true): Promise<string> {
    const message = new Promise<string>((resolve) => {
      this.page.once('dialog', async (dialog) => {
        resolve(dialog.message());
        await (confirm ? dialog.accept() : dialog.dismiss());
      });
    });
    await this.deleteButton.click();
    return message;
  }
}
