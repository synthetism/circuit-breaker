import { Unit, type UnitProps, createUnitSchema, type TeachingContract } from '@synet/unit';
import { type State, createState } from '@synet/state';

interface CircuitBreakerConfig {
  url: string;
  failureThreshold?: number;    // Default: 5
  timeoutMs?: number;          // Default: 30000 (30s)
  halfOpenSuccessThreshold?: number; // Default: 1
}

interface CircuitBreakerProps extends UnitProps {
  url: string;
  failureThreshold: number;
  timeoutMs: number;
  halfOpenSuccessThreshold: number;
  state: State;  // Dependency injection
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker extends Unit<CircuitBreakerProps> {
  protected constructor(props: CircuitBreakerProps) {
    super(props);
  }

  static create(config: CircuitBreakerConfig): CircuitBreaker {
    // Create state dependency with URL-safe ID
    const safeId = CircuitBreaker.safeId(config.url);
    
    const state = createState(safeId, {
      url: config.url,
      state: 'CLOSED',
      failures: 0,
      lastFailure: null,
      successCount: 0,
      openedAt: null
    });
    
    const props: CircuitBreakerProps = {
      dna: createUnitSchema({ 
        id: `circuit-breaker-${safeId}`, 
        version: '1.0.0' 
      }),
      url: config.url,
      failureThreshold: config.failureThreshold ?? 5,
      timeoutMs: config.timeoutMs ?? 30000,
      halfOpenSuccessThreshold: config.halfOpenSuccessThreshold ?? 1,
      state
    };
    
    return new CircuitBreaker(props);
  }

  // Convert any URL to a valid Unit ID using hash
  private static safeId(url: string): string {
    // Create hash from URL for guaranteed unique, valid ID
    // Use a simple but effective hash that preserves uniqueness
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to positive hex string
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    
    return hexHash;
  }

  // Core circuit breaker logic
  canProceed(): boolean {
    const currentState = this.getCircuitState();
    
    switch (currentState) {
      case 'CLOSED':
        return true;
        
      case 'OPEN': {
        // Check if timeout period has passed
        const openedAt = this.props.state.get<number>('openedAt');
        if (openedAt && Date.now() - openedAt >= this.props.timeoutMs) {
          // Transition to HALF_OPEN
          this.props.state.set('state', 'HALF_OPEN');
          this.props.state.set('successCount', 0);
          return true;
        }
        return false;
      }
        
      case 'HALF_OPEN':
        return true;
        
      default:
        return false;
    }
  }

  recordSuccess(): void {
    const currentState = this.getCircuitState();
    
    if (currentState === 'HALF_OPEN') {
      const successCount = (this.props.state.get<number>('successCount') ?? 0) + 1;
      this.props.state.set('successCount', successCount);
      
      // Close circuit if enough successes
      if (successCount >= this.props.halfOpenSuccessThreshold) {
        this.resetCircuit();
      }
    } else if (currentState === 'CLOSED') {
      // Reset failure count on success
      this.props.state.set('failures', 0);
      this.props.state.set('lastFailure', null);
    }
  }

  recordFailure(): void {
    const failures = (this.props.state.get<number>('failures') ?? 0) + 1;
    this.props.state.set('failures', failures);
    this.props.state.set('lastFailure', Date.now());
    
    const currentState = this.getCircuitState();
    
    if (currentState === 'HALF_OPEN') {
      // Failure in half-open immediately opens circuit
      this.openCircuit();
    } else if (failures >= this.props.failureThreshold) {
      // Open circuit if threshold reached
      this.openCircuit();
    }
  }

  getCircuitState(): CircuitState {
    return this.props.state.get<CircuitState>('state') ?? 'CLOSED';
  }

  resetCircuit(): void {
    this.props.state.set('state', 'CLOSED');
    this.props.state.set('failures', 0);
    this.props.state.set('lastFailure', null);
    this.props.state.set('successCount', 0);
    this.props.state.set('openedAt', null);
  }

  private openCircuit(): void {
    this.props.state.set('state', 'OPEN');
    this.props.state.set('openedAt', Date.now());
    this.props.state.set('successCount', 0);
  }

  // Get current stats for monitoring
  getStats() {
    return {
      url: this.props.url,
      state: this.getCircuitState(),
      failures: this.props.state.get<number>('failures') ?? 0,
      lastFailure: this.props.state.get<number>('lastFailure'),
      successCount: this.props.state.get<number>('successCount') ?? 0,
      openedAt: this.props.state.get<number>('openedAt'),
      config: {
        failureThreshold: this.props.failureThreshold,
        timeoutMs: this.props.timeoutMs,
        halfOpenSuccessThreshold: this.props.halfOpenSuccessThreshold
      }
    };
  }

  // Serialize circuit breaker state for persistence/logging
  toJson(): string {
    const data = {
      unitId: this.dna.id,
      version: this.dna.version,
      url: this.props.url,
      config: {
        failureThreshold: this.props.failureThreshold,
        timeoutMs: this.props.timeoutMs,
        halfOpenSuccessThreshold: this.props.halfOpenSuccessThreshold
      },
      state: {
        current: this.getCircuitState(),
        failures: this.props.state.get<number>('failures') ?? 0,
        lastFailure: this.props.state.get<number>('lastFailure'),
        successCount: this.props.state.get<number>('successCount') ?? 0,
        openedAt: this.props.state.get<number>('openedAt')
      },
      timestamp: Date.now()
    };
    
    return JSON.stringify(data, null, 2);
  }

  teach(): TeachingContract {
    return {
      unitId: this.dna.id,
      capabilities: {
        canProceed: () => this.canProceed.bind(this),
        recordSuccess: () => this.recordSuccess.bind(this),
        recordFailure: () => this.recordFailure.bind(this),
        getCircuitState: () => this.getCircuitState.bind(this),
        resetCircuit: () => this.resetCircuit.bind(this),
        getStats: () => this.getStats.bind(this),
        toJson: () => this.toJson.bind(this)
      }
    };
  }

  whoami(): string {
    return `CircuitBreaker[${this.props.url}] - ${this.getCircuitState()} - v${this.dna.version}`;
  }

  help(): string {
    const stats = this.getStats();
    return `
CircuitBreaker v${this.dna.version} - 80/20 resilience for ${this.props.url}

Current State: ${stats.state}
Failures: ${stats.failures}/${stats.config.failureThreshold}
${stats.lastFailure ? `Last Failure: ${new Date(stats.lastFailure).toISOString()}` : 'No failures'}

Configuration:
• Failure Threshold: ${stats.config.failureThreshold}
• Timeout: ${stats.config.timeoutMs}ms
• Half-Open Success Threshold: ${stats.config.halfOpenSuccessThreshold}

Operations:
• canProceed() - Check if requests should be allowed
• recordSuccess() - Record successful operation
• recordFailure() - Record failed operation  
• getCircuitState() - Get current circuit state
• resetCircuit() - Manually reset to CLOSED
• getStats() - Get complete circuit statistics

States:
• CLOSED: Normal operation, requests allowed
• OPEN: Circuit open, requests blocked for ${stats.config.timeoutMs}ms
• HALF_OPEN: Testing recovery, limited requests allowed

Teaching:
• Teaches all circuit breaker operations
• State is managed through dependency injection
`;
  }

  get url(): string {
    return this.props.url;
  }

  get state(): State {
    return this.props.state;
  }
}

export { CircuitBreaker, type CircuitBreakerConfig, type CircuitBreakerProps, type CircuitState };
