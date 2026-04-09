Here's a practical example of a custom command that audits project dependencies for vulnerabilities:

This audit command does three things:

Runs npm audit to find vulnerable installed packages
Runs npm audit fix to apply updates
Runs tests to verify the updates didn't break anything