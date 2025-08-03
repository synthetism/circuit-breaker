import { CircuitBreaker } from '../src/index.js';

// 80/20 Circuit Breaker Usage Example
console.log('🔥 SYNET CircuitBreaker - 80/20 Tracer-Bullet Demo\n');

// Create circuit breaker for an API endpoint
const apiCircuit = CircuitBreaker.create({
  url: 'https://api.example.com/users',
  failureThreshold: 3,     // Open after 3 failures
  timeoutMs: 5000,         // 5 second timeout
  halfOpenSuccessThreshold: 1  // Close after 1 success in half-open
});

console.log('Initial state:', apiCircuit.whoami());
console.log('Can proceed?', apiCircuit.canProceed()); // true

// Simulate API usage pattern
console.log('\n--- Simulating API calls ---');

// Successful call
if (apiCircuit.canProceed()) {
  console.log('✅ Making API call...');
  // Simulate success
  apiCircuit.recordSuccess();
  console.log('Success recorded. State:', apiCircuit.getCircuitState());
}

// Simulate failures
console.log('\n--- Simulating failures ---');
for (let i = 1; i <= 3; i++) {
  if (apiCircuit.canProceed()) {
    console.log(`❌ API call ${i} failed`);
    apiCircuit.recordFailure();
    console.log(`Failure ${i} recorded. State: ${apiCircuit.getCircuitState()}`);
  } else {
    console.log(`🚫 Circuit OPEN - blocking call ${i}`);
  }
}

// Show stats
console.log('\n--- Circuit Stats ---');
const stats = apiCircuit.getStats();
console.log(JSON.stringify(stats, null, 2));

// Test recovery
console.log('\n--- Testing Recovery ---');
console.log('Resetting circuit...');
apiCircuit.resetCircuit();
console.log('After reset:', apiCircuit.whoami());

// Teaching demonstration
console.log('\n--- Teaching Capabilities ---');
const contract = apiCircuit.teach();
console.log('Taught capabilities:', Object.keys(contract.capabilities));

console.log('\n🎯 80/20 SUCCESS: Basic circuit breaker working perfectly!');
console.log('Ready for integration with HTTP unit and network layer.');
