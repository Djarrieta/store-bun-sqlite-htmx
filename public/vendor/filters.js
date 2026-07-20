/**
 * Catalog category filter — navigates on select change.
 * Replaces inline onchange handler for CSP compliance.
 */
document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("category-filter");
  if (el) {
    el.addEventListener("change", function () {
      if (this.value) window.location = this.value;
    });
  }
});
