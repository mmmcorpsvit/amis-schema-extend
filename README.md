# AMIS Extended Schema Generator

This project is a tool to generate a comprehensive, extended JSON Schema for the [AMIS](https://github.com/baidu/amis) framework. It is designed to facilitate backend model generation (e.g., using Pydantic v2) by providing robust type definitions, enhanced metadata, and Draft-07 compliance.

## Features

- **Hybrid Schema Generation**: Combines the stable official release schema with a locally built latest version to ensure maximum coverage.
- **Augmentation**:
    - **Expression Hints**: Automatically marks fields like `visibleOn` and `disabledOn` as supporting expressions.
    - **Defaults**: Injects default values where applicable.
    - **Event Metadata**: Ensures event definitions are present for typed event handling.
- **Robust Validation**: Includes a suite of validation scripts to ensure the generated schema is complete and structurally sound.
- **Draft-07 Compliance**: Ensures compatibility with most JSON Schema tools.

## Usage

### 1. Installation
```bash
npm install
```

### 2. Generate Schema
Run the main script to download, build, merge, and augment the schema:
```bash
npm start
```
This will produce `extended-schema.json` in the root directory.

### 3. Verify & Validate
We provide three levels of validation checks:
*   **Completeness Check**:
    ```bash
    npx ts-node src/validate-completeness.ts
    ```
    (Checks coverage counts and Draft-07 validity)

*   **Deep Integrity Check**:
    ```bash
    npx ts-node src/deep-validate.ts
    ```
    (Recursively checks all `$ref` links and scores components)

*   **Targeted Component Check**:
    ```bash
    npx ts-node src/verify-components.ts Button Form CRUD Dialog
    ```
    (Deep inspection of specific components)

## Project Structure
*   `src/index.ts`: Main entry point.
*   `src/augment.ts`: Logic for injecting metadata and hints.
*   `src/merge.ts`: Smart merging strategy for schemas.
*   `src/repo.ts`: Handles checking out the AMIS repo and building dependencies.
*   `src/validate*.ts`: various validation suites.

## Output
The primary output is `extended-schema.json`. This file is ready to be used as input for `datamodel-code-generator` or other schema-to-code tools.
