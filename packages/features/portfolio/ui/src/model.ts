import { type FeedStatus, type HistoryRange } from '@tickr/portfolio-domain';

/**
 * The UI models, mirroring HoldingUi.kt and PortfolioUiState.kt.
 *
 * These are separate from the domain models on purpose, and the Kotlin project
 * makes the same split. The domain `Holding` has a cost basis and a quantity;
 * the UI one has a formatted value, a formatted return, and a colour. Keeping
 * them apart is what stops a formatting decision from leaking into the domain
 * and a domain change from silently altering the layout.
 */
export interface HoldingUi {
  readonly symbol: string;
  readonly name: string;
  readonly quantity: number;
  readonly price: number;
  readonly value: number;
  readonly costBasis: number;
  readonly profit: number;
  readonly returnPercent: number;
  readonly dayChangePercent: number;
  readonly history: readonly number[];
  readonly color: string;
  /** False while this row has no quote yet. */
  readonly isPriced: boolean;
}

export interface PortfolioUiState {
  readonly holdings: readonly HoldingUi[];
  readonly totalValue: number;
  readonly totalProfit: number;
  readonly totalReturnPercent: number;
  readonly dayChangePercent: number;
  readonly totalHistory: readonly number[];
  readonly feedStatus: FeedStatus;
  readonly displayedRange: HistoryRange;
  readonly isLoading: boolean;
  readonly isPartiallyPriced: boolean;
  readonly errorMessage: string | null;
  readonly overviewScrubIndex: number | null;
  readonly detailScrubIndex: number | null;
  readonly selectedSymbol: string | null;
}
