export type StreamMidsSubscription = "allMids" | "trades" | "l2Book";

export type GrpcMidPrice = {
  coin: string;
  price: number;
  ts_ms: string;
  source: string;
  channel: string;
  upstream_ts_ms?: string;
  ingest_ts_us?: string;
  publish_ts_us?: string;
  seq?: string;
  cached?: boolean;
  best_bid?: number;
  best_ask?: number;
  size?: number;
  side?: string;
  trade_id?: string;
  stream_source?: string;
  latency_ms?: number;
};

export type GrpcBlockNumber = {
  hex: string;
  number: string;
  ts_ms: string;
  latency_ms?: number;
};

export type LiquidationFeedEvent = {
  symbol: string;
  tx_hash: string;
  block_number: string;
  log_index: number;
  ts_ms: string;
  source: string;
  channel: string;
  address: string;
  topic0: string;
  data: string;
};

export type UnifiedTradePayload = {
  coin: string;
  price: number;
  size: number;
  notional: number;
  side: string;
  trade_id: string;
};

export type BookDeltaRow = {
  px: string;
  sz: number;
  op: "upsert" | "delete";
};

export type UnifiedL4DeltaPayload = {
  coin: string;
  delta: {
    bids: BookDeltaRow[];
    asks: BookDeltaRow[];
  };
  raw_levels: {
    bids?: Array<Record<string, unknown>>;
    asks?: Array<Record<string, unknown>>;
  };
};

export type UnifiedBlockMetricsPayload = {
  block_number: number;
  block_size_bytes: number;
  tx_count: number;
  gas_used: number;
  gas_limit: number;
};

export type UnifiedDecodedTransfer = {
  from?: string;
  to?: string;
  value?: number;
};

export type UnifiedEvmLogPayload = {
  address: string;
  topics: string[];
  data: string;
  tx_hash: string;
  block_number: number;
  log_index: number;
  removed: boolean;
  decoded?: UnifiedDecodedTransfer;
};

export type UnifiedEventEnvelope<TPayload = Record<string, unknown>> = {
  source: string;
  category: string;
  stream: string;
  event_type: string;
  symbol: string;
  ts_ms: number;
  ts_us: number;
  ingest_ts_ms: number;
  ingest_ts_us: number;
  payload: TPayload;
  seq?: number;
  received_at?: string;
};

export type UnifiedTradeEvent = UnifiedEventEnvelope<UnifiedTradePayload> & {
  category: "trade";
  stream: "trades";
  event_type: "trade";
};

export type UnifiedL4DeltaEvent = UnifiedEventEnvelope<UnifiedL4DeltaPayload> & {
  category: "orderflow_signal";
  stream: "l4_delta";
  event_type: "l4_delta";
};

export type UnifiedBlockMetricsEvent = UnifiedEventEnvelope<UnifiedBlockMetricsPayload> & {
  category: "block_metrics";
  stream: "eth_getBlockByNumber";
  event_type: "block_metrics";
};

export type UnifiedLiquidationWarningEvent = UnifiedEventEnvelope<UnifiedEvmLogPayload> & {
  category: "evm_log";
  stream: "eth_getLogs";
  event_type: "liquidation_warning";
};

export type UnifiedEventsQuery = {
  limit?: number;
  eventType?: string;
  stream?: string;
};

export type UnifiedEventsResponse<TEvent = UnifiedEventEnvelope> = {
  events: TEvent[];
  count: number;
  time: string;
};

export type UnifiedLatencySummary = {
  count: number;
  target_us: number;
  target_hit_rate: number;
  last_us: number;
  avg_us: number;
  p50_us: number;
  p95_us: number;
  min_us: number;
  max_us: number;
};

export type UnifiedConsensusPulse = {
  captured_at: string | null;
  current_block_height: number | null;
  small_block_base_fee_gwei: number;
  large_block_base_fee_gwei: number;
  gas_delta_gwei: number;
  tokyo_p2p_latency_ms: number;
  error: string;
};

export type UnifiedMicrostructureStats = {
  best_bid: number | null;
  best_ask: number | null;
  mid_px: number | null;
  spread: number | null;
  book_depths: {
    bid_levels: number;
    ask_levels: number;
    l2_bid_notional: number;
    l2_ask_notional: number;
    l4_bid_notional: number;
    l4_ask_notional: number;
  };
  l2: {
    snapshots_total: number;
  };
  l4: {
    events_total: number;
    upserts_total: number;
    deletes_total: number;
    cancellations_proxy_total: number;
  };
  trades: {
    events_total: number;
    volume_base_total: number;
    notional_usd_total: number;
    last_price: number | null;
    last_side: string;
  };
  blocks: {
    events_total: number;
    last_block: number | null;
    last_size_bytes: number;
    last_tx_count: number;
    sample_count: number;
    avg_size_bytes: number;
    p95_size_bytes: number;
    max_size_bytes: number;
    avg_tx_count: number;
    p95_tx_count: number;
    max_tx_count: number;
  };
};

export type UnifiedStats = {
  started_at: string;
  uptime_s: number;
  events_total: number;
  events_by_source: Record<string, number>;
  events_by_category: Record<string, number>;
  api_requests_total: number;
  api_requests_unauthorized: number;
  api_requests_rate_limited: number;
  connected_stream_clients: number;
  connected_disk_sync_clients: number;
  latest_seq: number;
  latency_us: {
    target_us: number;
    processing: UnifiedLatencySummary;
    source_to_ingest: UnifiedLatencySummary;
    processing_by_stream: Record<string, UnifiedLatencySummary>;
    source_to_ingest_by_stream: Record<string, UnifiedLatencySummary>;
  };
  microstructure: UnifiedMicrostructureStats;
  disk_sync: {
    messages_total: number;
    last_seq: number;
    last_message_at: string | null;
  };
  consensus_pulse: UnifiedConsensusPulse;
};

export type UnifiedStatsResponse = {
  stats: UnifiedStats;
  time: string;
};

export type UnifiedConsensusPulseResponse = {
  consensus_pulse: UnifiedConsensusPulse;
  time: string;
};

export type StatusLatencySummary = {
  count: number;
  last_ms: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  min_ms: number;
  max_ms: number;
};

export type StatusSnapshot = {
  captured_at: string;
  captured_at_epoch: number;
  service: {
    name: string;
    uptime_s: number;
    publish_delay_s: number;
    day_utc: string;
  };
  latency_ms: {
    private_rpc: StatusLatencySummary;
    public_rpc: StatusLatencySummary;
  };
  failover?: {
    primary?: {
      ok: boolean;
      latency_ms: number;
      last_error: string;
    };
    secondaries?: Array<{
      name: string;
      ok: boolean;
      latency_ms: number;
      last_error: string;
    }>;
    healthy_paths?: number;
    total_paths?: number;
    primary_success_rate?: number;
  };
  chain?: {
    current_block?: number;
    transactions_today_observed?: number;
    blocks_scanned_today?: number;
    blocks_pending_scan?: number;
    day_start_block?: number;
  };
  market?: Record<string, unknown>;
  traffic?: Record<string, unknown>;
};

export type StatusSnapshotEnvelope = {
  published_at: string;
  delayed: boolean;
  delay_s: number;
  snapshot: StatusSnapshot;
};

export type StatusHealth = {
  status: string;
  time: string;
};

export type StatusAdminTokens = {
  published_at: string;
  tokens: Array<Record<string, unknown>>;
  requests_by_category: Record<string, number>;
  requests_by_service_type: Record<string, number>;
  requests_by_key_status: Record<string, number>;
};
