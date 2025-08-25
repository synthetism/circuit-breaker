# Circuit Breaker Unit

```bash
  _____ _                _ _     ____                 _             
 / ____(_)              (_) |   |  _ \               | |            
| |     _ _ __ ___ _   _ _| |_  | |_) |_ __ ___  __ _| | _____ _ __ 
| |    | | '__/ __| | | | | __| |  _ <| '__/ _ \/ _` | |/ / _ \ '__|
| |____| | | | (__| |_| | | |_  | |_) | | |  __/ (_| |   <  __/ |   
 \_____|_|_|  \___|\__,_|_|\__| |____/|_|  \___|\__,_|_|\_\___|_|   
                                                                   
version: 1.0.0
```

**Circuit protection for resilient systems**

Intelligent circuit breaker pattern implementation that prevents cascading failures and provides graceful degradation for external service dependencies.

## Quick Start

```typescript
import { CircuitBreaker } from '@synet/circuit-breaker';

// Create circuit breaker for a service
const apiCircuit = CircuitBreaker.create({
  url: 'https://api.external.com',
  failureThreshold: 5,
  timeoutMs: 30000
});

// Check if requests should proceed
if (apiCircuit.canProceed()) {
  try {
    const result = await callExternalAPI();
    apiCircuit.recordSuccess();
    return result;
  } catch (error) {
    apiCircuit.recordFailure();
    throw error;
  }
} else {
  throw new Error('Circuit breaker is OPEN - service unavailable');
}
```

## Features

### **Circuit States**
- **CLOSED** - Normal operation, requests allowed
- **OPEN** - Circuit tripped, requests blocked for timeout period  
- **HALF_OPEN** - Testing recovery, limited requests allowed

### **Smart Protection**
- **Failure threshold** monitoring with configurable limits
- **Automatic recovery** testing after timeout periods
- **Success confirmation** before fully closing circuit
- **Statistics tracking** for monitoring and alerting

### **Unit Architecture Compliance**
- **Teaching contracts** for circuit composition  
- **State dependency injection** for flexible storage
- **Zero dependencies** - pure TypeScript
- **Clear boundaries** between configuration and runtime

## Installation

```bash
npm install @synet/circuit-breaker
```

```typescript
import { CircuitBreaker } from '@synet/circuit-breaker';
```

## API Reference

### Circuit Creation

```typescript
interface CircuitBreakerConfig {
  url: string;                      // Service identifier
  failureThreshold?: number;        // Default: 5 failures
  timeoutMs?: number;              // Default: 30000ms (30s)
  halfOpenSuccessThreshold?: number; // Default: 1 success
}

const circuit = CircuitBreaker.create({
  url: 'https://payment-service.com',
  failureThreshold: 3,
  timeoutMs: 60000,
  halfOpenSuccessThreshold: 2
});
```

### Core Operations

```typescript
// Check if operation should proceed
const canProceed: boolean = circuit.canProceed();

// Record operation results
circuit.recordSuccess();  // Mark operation as successful
circuit.recordFailure();  // Mark operation as failed

// Get current state
const state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = circuit.getCircuitState();

// Manual reset (emergency use)
circuit.resetCircuit();
```

### Monitoring

```typescript
// Get comprehensive statistics
const stats = circuit.getStats();
console.log({
  url: stats.url,
  state: stats.state,
  failures: stats.failures,
  lastFailure: stats.lastFailure,
  config: stats.config
});
```

## Real-World Example

```typescript
import { CircuitBreaker } from '@synet/circuit-breaker';

// Payment service protection
const paymentCircuit = CircuitBreaker.create({
  url: 'payment-gateway',
  failureThreshold: 3,     // Trip after 3 failures
  timeoutMs: 60000,        // Wait 60s before retry
  halfOpenSuccessThreshold: 2  // Need 2 successes to close
});

async function processPayment(amount: number, cardToken: string) {
  // Check circuit state before proceeding
  if (!paymentCircuit.canProceed()) {
    // Circuit is OPEN - use fallback or return error
    throw new Error('Payment service unavailable - please try again later');
  }

  try {
    // Attempt payment processing
    const result = await paymentGateway.charge({
      amount,
      token: cardToken
    });
    
    // Record success on successful payment
    paymentCircuit.recordSuccess();
    return result;
    
  } catch (error) {
    // Record failure on any error
    paymentCircuit.recordFailure();
    
    // Re-throw for application handling
    throw new Error(`Payment failed: ${error.message}`);
  }
}

// Usage with fallback strategy
async function handlePayment(amount: number, cardToken: string) {
  try {
    return await processPayment(amount, cardToken);
  } catch (error) {
    if (error.message.includes('unavailable')) {
      // Circuit is open - offer alternative
      return { 
        status: 'deferred',
        message: 'Payment will be processed when service is restored'
      };
    } else {
      // Actual payment error
      throw error;
    }
  }
}
```

## Circuit States Flow

```
CLOSED ──[failures ≥ threshold]──> OPEN
   ↑                                  │
   │                                  │
   └──[success count ≥ threshold]──── │
                                      │
                              [timeout elapsed]
                                      │
                                      ↓
                                 HALF_OPEN
                                      │
                              [any failure]
                                      │
                                      └────> OPEN
```

## Error Handling

```typescript
// The circuit breaker doesn't catch errors - it monitors them
try {
  if (circuit.canProceed()) {
    const result = await riskyOperation();
    circuit.recordSuccess();
    return result;
  } else {
    // Handle circuit OPEN state
    return fallbackResponse();
  }
} catch (error) {
  // Always record failures
  circuit.recordFailure();
  // Handle error according to your application logic
  throw error;
}
```

---

Built with [Unit Architecture](https://github.com/synthetism/unit) • Part of the SYNET ecosystem
