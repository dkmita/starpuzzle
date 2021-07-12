function* range(start, end) {
    for (; start <= end; ++start) { yield start; }
}

function last(arr) { return arr[arr.length - 1]; }

function* numericCombinations(n, r, loc = []) {
    const idx = loc.length;
    if (idx === r) {
        yield loc;
        return;
    }
    for (let next of range(idx ? last(loc) + 1 : 0, n - r + idx)) { yield* numericCombinations(n, r, loc.concat(next)); }
}

export default function* combinations(arr, r) {
    for (let idxs of numericCombinations(arr.length, r)) { yield idxs.map(i => arr[i]); }
}

