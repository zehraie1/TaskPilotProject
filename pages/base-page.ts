import { expect, type Locator, type Page } from '@playwright/test';

/** Shared layout: sidebar navigation + header "New task" button + global error alert. */
export abstract class BasePage {
  readonly page: Page;
  readonly nav: Locator;
  readonly headerNewTask: Locator;
  readonly heading: Locator;
  readonly errorState: Locator;
  readonly retryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nav = page.getByRole('navigation', { name: 'Primary navigation' });
    this.headerNewTask = page.getByTestId('header-create-task');
    this.heading = page.getByRole('main').getByRole('heading', { level: 1 });
    this.errorState = page.getByRole('main').getByRole('heading', { name: 'We couldn’t load this page' });
    this.retryButton = page.getByRole('main').getByRole('button', { name: 'Try again' });
  }

  async navigateTo(section: 'Dashboard' | 'Tasks'): Promise<void> {
    await this.nav.getByRole('link', { name: section, exact: true }).click();
    await expect(this.heading).toHaveText(section);
  }

  /** Wait until any "Loading…" status inside <main> has disappeared. */
  async waitForLoaded(): Promise<void> {
    await expect(this.page.getByRole('main').getByRole('status').filter({ hasText: /Loading/ })).toHaveCount(0);
  }
}
