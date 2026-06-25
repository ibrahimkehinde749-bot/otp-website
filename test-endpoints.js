async function testEndpoints() {
  const baseUrl = 'http://localhost:4000'

  console.log('Testing SMSDIGITS API endpoints...\n')

  try {
    console.log('1. Testing POST /api/purchase')
    const purchaseRes = await fetch(`${baseUrl}/api/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'USA', service: 'WhatsApp' }),
    })
    const purchaseData = await purchaseRes.json()
    console.log(`Status: ${purchaseRes.status}`)
    console.log(`Response:`, purchaseData)
    console.log()
  } catch (err) {
    console.error('Error testing purchase:', err.message)
  }

  try {
    console.log('2. Testing GET /api/orders/test-order-id')
    const orderRes = await fetch(`${baseUrl}/api/orders/test-order-id`, {
      headers: { 'Content-Type': 'application/json' },
    })
    const orderData = await orderRes.json()
    console.log(`Status: ${orderRes.status}`)
    console.log(`Response:`, orderData)
    console.log()
  } catch (err) {
    console.error('Error testing get order:', err.message)
  }

  try {
    console.log('3. Testing POST /api/orders/test-order-id/complete')
    const completeRes = await fetch(`${baseUrl}/api/orders/test-order-id/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const completeData = await completeRes.json()
    console.log(`Status: ${completeRes.status}`)
    console.log(`Response:`, completeData)
    console.log()
  } catch (err) {
    console.error('Error testing complete:', err.message)
  }

  try {
    console.log('4. Testing POST /api/orders/test-order-id/cancel')
    const cancelRes = await fetch(`${baseUrl}/api/orders/test-order-id/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const cancelData = await cancelRes.json()
    console.log(`Status: ${cancelRes.status}`)
    console.log(`Response:`, cancelData)
  } catch (err) {
    console.error('Error testing cancel:', err.message)
  }
}

testEndpoints()
