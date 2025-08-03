import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../src/index.js';

describe('CircuitBreaker - 80/20 Tracer-Bullet Tests', () => {
  it('should create circuit breaker with sensible defaults', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com'
    });
    
    expect(circuit).toBeDefined();
    expect(circuit.whoami()).toContain('CircuitBreaker');
    expect(circuit.whoami()).toContain('CLOSED');
    expect(circuit.canProceed()).toBe(true);
  });

  it('should handle basic failure sequence', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 3
    });
    
    // Should start closed and allow requests
    expect(circuit.getCircuitState()).toBe('CLOSED');
    expect(circuit.canProceed()).toBe(true);
    
    // Record failures
    circuit.recordFailure();
    circuit.recordFailure();
    expect(circuit.getCircuitState()).toBe('CLOSED'); // Still closed
    expect(circuit.canProceed()).toBe(true);
    
    // Threshold breach - should open
    circuit.recordFailure();
    expect(circuit.getCircuitState()).toBe('OPEN');
    expect(circuit.canProceed()).toBe(false);
  });

  it('should recover through half-open state', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 2,
      timeoutMs: 100  // Fast timeout for testing
    });
    
    // Force open
    circuit.recordFailure();
    circuit.recordFailure();
    expect(circuit.getCircuitState()).toBe('OPEN');
    
    // Wait for timeout
    setTimeout(() => {
      expect(circuit.canProceed()).toBe(true); // Should transition to HALF_OPEN
      expect(circuit.getCircuitState()).toBe('HALF_OPEN');
      
      // Success in half-open should close circuit
      circuit.recordSuccess();
      expect(circuit.getCircuitState()).toBe('CLOSED');
      expect(circuit.canProceed()).toBe(true);
    }, 150);
  });

  it('should provide useful stats for monitoring', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 5,
      timeoutMs: 30000
    });
    
    const stats = circuit.getStats();
    
    expect(stats.url).toBe('https://api.example.com');
    expect(stats.state).toBe('CLOSED');
    expect(stats.failures).toBe(0);
    expect(stats.config.failureThreshold).toBe(5);
    expect(stats.config.timeoutMs).toBe(30000);
  });

  it('should reset circuit manually', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 2
    });
    
    // Force failures and open
    circuit.recordFailure();
    circuit.recordFailure();
    expect(circuit.getCircuitState()).toBe('OPEN');
    
    // Manual reset
    circuit.resetCircuit();
    expect(circuit.getCircuitState()).toBe('CLOSED');
    expect(circuit.canProceed()).toBe(true);
    
    const stats = circuit.getStats();
    expect(stats.failures).toBe(0);
  });

  it('should teach circuit breaker capabilities', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com'
    });
    
    const contract = circuit.teach();
    
    expect(contract.unitId).toContain('circuit-breaker');
    expect(contract.capabilities.canProceed).toBeDefined();
    expect(contract.capabilities.recordSuccess).toBeDefined();
    expect(contract.capabilities.recordFailure).toBeDefined();
    expect(contract.capabilities.getCircuitState).toBeDefined();
    expect(contract.capabilities.resetCircuit).toBeDefined();
    expect(contract.capabilities.getStats).toBeDefined();
  });

  it('should handle half-open failure correctly', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 2,
      timeoutMs: 1  // Very short timeout
    });
    
    // Force open
    circuit.recordFailure();
    circuit.recordFailure();
    expect(circuit.getCircuitState()).toBe('OPEN');
    
    // Sleep briefly to ensure timeout passes
    const start = Date.now();
    while (Date.now() - start < 5) { /* wait */ }
    
    // Should transition to half-open on canProceed check
    expect(circuit.canProceed()).toBe(true);
    expect(circuit.getCircuitState()).toBe('HALF_OPEN');
    
    // Failure in half-open should immediately open again
    circuit.recordFailure();
    expect(circuit.getCircuitState()).toBe('OPEN');
    expect(circuit.canProceed()).toBe(false);
  });
});
