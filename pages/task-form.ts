import { expect, type Locator, type Page } from '@playwright/test';
import type { TaskInput, TaskPriority, TaskStatus } from '../utils/test-data.ts';

/** The Create / Edit task modal dialog (data-testid="task-form"). */
export class TaskForm {
  readonly page: Page;
  readonly dialog: Locator;
  readonly form: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly status: Locator;
  readonly priority: Locator;
  readonly dueDate: Locator;
  readonly submit: Locator;
  readonly cancel: Locator;
  readonly close: Locator;
  /** Field-level and form-level validation messages (role=alert). */
  readonly alerts: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByRole('dialog');
    this.form = this.dialog.getByTestId('task-form');
    this.title = this.dialog.getByRole('textbox', { name: /^Title/ });
    this.description = this.dialog.getByRole('textbox', { name: 'Description' });
    this.status = this.dialog.getByRole('combobox', { name: 'Status' });
    this.priority = this.dialog.getByRole('combobox', { name: 'Priority' });
    this.dueDate = this.dialog.getByLabel('Due date');
    this.submit = this.dialog.getByTestId('save-task');
    this.cancel = this.dialog.getByRole('button', { name: 'Cancel' });
    this.close = this.dialog.getByRole('button', { name: 'Close dialog' });
    this.alerts = this.dialog.getByRole('alert');
  }

  async expectOpen(mode: 'Create task' | 'Edit task'): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole('heading', { level: 2 })).toHaveText(mode);
  }

  async fill(task: Partial<TaskInput>): Promise<void> {
    if (task.title !== undefined) await this.title.fill(task.title);
    if (task.description !== undefined) await this.description.fill(task.description ?? '');
    if (task.status) await this.status.selectOption(task.status satisfies TaskStatus);
    if (task.priority) await this.priority.selectOption(task.priority satisfies TaskPriority);
    if (task.due_date !== undefined) await this.dueDate.fill(task.due_date ?? '');
  }

  /** Submit and wait for the dialog to close (success path). */
  async save(): Promise<void> {
    await this.submit.click();
    await expect(this.dialog).toBeHidden();
  }

  async fillAndSave(task: Partial<TaskInput>): Promise<void> {
    await this.fill(task);
    await this.save();
  }
}
