
// Returns UTC current time, formatted as a string to 'seconds' precision
function ts() {
    return new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZone: 'UTC'});
}

// Sleeps given thread for specified number of milliseconds
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns true if value is numeric
function isNumeric(value) {
    return !isNaN(parseFloat(value)) && isFinite(value);
}

module.exports = {
    ts,
    sleep,
    isNumeric
};