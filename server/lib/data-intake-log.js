'use strict';
// Local stub — intake log (no-op in local dev).
function createDataIntakeLog() {
  return {
    append() {},
    stats() { return {}; },
  };
}
module.exports = { createDataIntakeLog };
