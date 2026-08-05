import '@testing-library/jest-dom'

// jsdom não implementa scrollIntoView; componentes que o chamam em useEffect
// (ex.: ConsultationChat) quebram ao montar em teste sem este shim.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
