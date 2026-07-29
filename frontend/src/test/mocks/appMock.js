// Fake of 'firebase/app' — initializeApp just needs to return something the
// mocked getAuth/getFirestore in the other mocks can accept as their first arg.
export function initializeApp(config) {
  return { __type: 'app', options: config }
}
