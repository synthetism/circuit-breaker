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

describe('CircuitBreaker - URL Safe ID Generation & JSON Serialization', () => {
  it('should generate consistent hash-based IDs for any URL', () => {
    const circuit1 = CircuitBreaker.create({ url: 'https://api.example.com' });
    const circuit2 = CircuitBreaker.create({ url: 'https://api.example.com' }); // Same URL
    const circuit3 = CircuitBreaker.create({ url: 'http://api.example.com' });  // Different protocol
    
    // Same URL should generate same ID
    expect(circuit1.dna.id).toBe(circuit2.dna.id);
    
    // Different URL (protocol) should generate different ID
    expect(circuit1.dna.id).not.toBe(circuit3.dna.id);
    
    // Both should preserve original URLs
    expect(circuit1.getStats().url).toBe('https://api.example.com');
    expect(circuit3.getStats().url).toBe('http://api.example.com');
  });

  it('should handle all URL types with hash encoding', () => {
    const complexUrls = [
      'https://api.example.com',
      'http://localhost:3000',
      'https://auth.api.example-corp.com:8443/v1/auth',
      'http://192.168.1.100:8080/health',
      'https://subdomain.example.co.uk',
      'http://api_service.internal-network.com',
      'https://user:password@secure.example.com:443/complex/path?query=value&other=data',
      'ws://websocket.example.com:9000',
      'ftp://files.example.com/uploads'
    ];
    
    for (const url of complexUrls) {
      const circuit = CircuitBreaker.create({ url });
      
      // Should create valid circuit with hash-based ID
      expect(circuit.dna.id).toMatch(/^circuit-breaker-[a-f0-9]+$/);
      expect(circuit.getStats().url).toBe(url);
      expect(circuit.canProceed()).toBe(true);
      
      // ID should be reasonable length
      expect(circuit.dna.id.length).toBeLessThan(50);
    }
  });

  it('should serialize circuit state to JSON', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 3,
      timeoutMs: 5000
    });
    
    // Record some activity
    circuit.recordFailure();
    circuit.recordFailure();
    
    const json = circuit.toJson();
    const data = JSON.parse(json);
    
    // Verify JSON structure
    expect(data.unitId).toBeDefined();
    expect(data.version).toBe('1.0.0');
    expect(data.url).toBe('https://api.example.com');
    expect(data.config.failureThreshold).toBe(3);
    expect(data.config.timeoutMs).toBe(5000);
    expect(data.state.current).toBe('CLOSED');
    expect(data.state.failures).toBe(2);
    expect(data.timestamp).toBeCloseTo(Date.now(), -2); // Within 100ms
  });

  it('should include circuit state changes in JSON', () => {
    const circuit = CircuitBreaker.create({
      url: 'https://api.example.com',
      failureThreshold: 2
    });
    
    // Force circuit open
    circuit.recordFailure();
    circuit.recordFailure();
    
    const openJson = circuit.toJson();
    const openData = JSON.parse(openJson);
    
    expect(openData.state.current).toBe('OPEN');
    expect(openData.state.failures).toBe(2);
    expect(openData.state.openedAt).toBeDefined();
    
    // Reset and verify
    circuit.resetCircuit();
    
    const closedJson = circuit.toJson();
    const closedData = JSON.parse(closedJson);
    
    expect(closedData.state.current).toBe('CLOSED');
    expect(closedData.state.failures).toBe(0);
    expect(closedData.state.openedAt).toBeNull();
  });

 

  it('should create different IDs for different URLs consistently', () => {
    const urls = [
      'https://api1.example.com',
      'https://api2.example.com',
      'http://localhost:3000',
      'https://api1.example.com:8080'
    ];
    
    const circuits = urls.map(url => CircuitBreaker.create({ url }));
    const ids = circuits.map(c => c.dna.id);
    
    // All IDs should be unique
    expect(new Set(ids).size).toBe(urls.length);
    
    // Same URL should generate same ID
    const duplicate = CircuitBreaker.create({ url: urls[0] });
    expect(duplicate.dna.id).toBe(ids[0]);
  });
});
