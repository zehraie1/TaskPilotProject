import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page.ts';

export type MetricName = 'Total tasks' | 'Pending' | 'In progress' | 'Completed' | 'Overdue';

/** "/" — dashboard with metric cards, charts and recent activity. */
export class DashboardPage extends BasePage {
  readonly metrics: Locator;
  readonly statusChart: Locator;
  readonly priorityMix: Locator;
  readonly recentActivity: Locator;

  constructor(page: Page) {
    super(page);
    this.metrics = page.getByRole('region', { name: 'Task metrics' });
    this.statusChart = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Status distribution' }) });
    this.priorityMix = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Priority mix' }) });
    this.recentActivity = page.getByRole('main').getByRole('heading', { name: 'Recent activity' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.heading).toHaveText('Dashboard');
    await this.waitForLoaded();
  }

  /** The numeric value element of a metric card. */
  metricValue(name: MetricName): Locator {
    return this.metrics.getByRole('article').filter({ hasText: name }).getByRole('paragraph').nth(1);
  }

  async readMetric(name: MetricName): Promise<number> {
    await expect(this.metricValue(name)).toHaveText(/^\d+$/);
    return Number(await this.metricValue(name).textContent());
  }

  recentActivityLink(title: string): Locator {
    return this.page.getByRole('main').getByRole('link', { name: title, exact: true });
  }
}
