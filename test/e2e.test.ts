import {
  getData,
  wrapDocument,
  wrapDocuments,
  obfuscateDocument,
  verifySignature,
  validateSchema
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
} from "../dist/cjs/index";
import {
  IdentityProofType,
  Method,
  OpenAttestationDocument,
  ProofType,
  TemplateType
} from "../src/__generated__/schemaV3";
import { OpenAttestationDocument as v2OpenAttestationDocument } from "../src/__generated__/schemaV2";
import { IdentityProofType as v2IdentityProofType } from "../src/__generated__/schemaV2";
// Disable tslint import/no-unresolved for this because it usually doesn't exist until build runs
type WrappedDocumentReturnType = ReturnType<typeof wrapDocument>;
const openAttestationDatav2: v2OpenAttestationDocument & { foo: string } = {
  issuers: [
    {
      name: "John",
      identityProof: {
        type: v2IdentityProofType.DNSTxt,
        location: "tradetrust.io"
      },
      documentStore: "0x9178F546D3FF57D7A6352bD61B80cCCD46199C2d"
    }
  ],
  foo: "bar"
};

const openAttestationData: OpenAttestationDocument = {
  reference: "document identifier",
  validFrom: "2010-01-01T19:23:24Z",
  name: "document owner name",
  template: {
    name: "any",
    type: TemplateType.EmbeddedRenderer,
    url: "http://some.example.com"
  },
  issuer: {
    id: "http://some.example.com",
    name: "DEMO STORE",
    identityProof: {
      type: IdentityProofType.DNSTxt,
      location: "tradetrust.io"
    }
  },
  proof: {
    type: ProofType.OpenAttestationSignature2018,
    value: "0x9178F546D3FF57D7A6352bD61B80cCCD46199C2d",
    method: Method.TokenRegistry
  }
};

const openAttestationDataWithW3CDID = {
  ...openAttestationData,
  issuer: {
    ...openAttestationData.issuer,
    identityProof: {
      ...openAttestationData.issuer.identityProof,
      type: IdentityProofType.W3CDid,
      location: "did:ethr:0x0xE6Fe788d8ca214A080b0f6aC7F48480b2AEfa9a6"
    }
  }
};

const datum = [
  {
    key1: "test",
    ...openAttestationData
  },
  {
    key1: "hello",
    key2: "item2",
    ...openAttestationData
  },
  {
    key1: "item1",
    key2: "true",
    key3: 3.14159,
    key4: false,
    ...openAttestationData
  },
  {
    key1: "item2",
    ...openAttestationData
  }
];

describe("E2E Test Scenarios", () => {
  describe("v2", () => {
    test("creates a wrapped document", () => {
      const wrappedDocument = wrapDocument(openAttestationDatav2);
      expect(wrappedDocument.data.foo).toEqual(expect.stringContaining("bar"));
      expect(wrappedDocument.signature.type).toBe("SHA3MerkleProof");
      expect(wrappedDocument.signature.targetHash).toBeDefined();
      expect(wrappedDocument.signature.merkleRoot).toBeDefined();
      expect(wrappedDocument.signature.proof).toEqual([]);
      expect(wrappedDocument.signature.merkleRoot).toBe(wrappedDocument.signature.targetHash);
    });
  });
  describe("Issuing a single documents", () => {
    const document = datum[0];
    let wrappedDocument: WrappedDocumentReturnType;

    test("fails for malformed data", () => {
      const malformedData = {
        ...document,
        issuer: undefined
      };
      const action = () => wrapDocument(malformedData);
      expect(action).toThrow("Invalid document");
    });

    beforeAll(() => {
      wrappedDocument = wrapDocument(document, {
        externalSchemaId: "http://example.com/schema.json",
        version: "open-attestation/3.0"
      });
    });

    test("creates a wrapped document", () => {
      expect(wrappedDocument.schema).toBe("http://example.com/schema.json");
      expect(wrappedDocument.data.key1).toEqual(expect.stringContaining("test"));
      expect(wrappedDocument.signature.type).toBe("SHA3MerkleProof");
      expect(wrappedDocument.signature.targetHash).toBeDefined();
      expect(wrappedDocument.signature.merkleRoot).toBeDefined();
      expect(wrappedDocument.signature.proof).toEqual([]);
      expect(wrappedDocument.signature.merkleRoot).toBe(wrappedDocument.signature.targetHash);
    });
    test("creates a wrapped document with W3C-DID IdentityProof", () => {
      const wrappedDocumentWithW3CDID = wrapDocument(openAttestationDataWithW3CDID, {
        externalSchemaId: "http://example.com/schema.json",
        version: "open-attestation/3.0"
      });
      expect(wrappedDocumentWithW3CDID.schema).toBe("http://example.com/schema.json");
      expect(wrappedDocumentWithW3CDID.signature.type).toBe("SHA3MerkleProof");
      expect(wrappedDocumentWithW3CDID.signature.targetHash).toBeDefined();
      expect(wrappedDocumentWithW3CDID.signature.merkleRoot).toBeDefined();
      expect(wrappedDocumentWithW3CDID.signature.proof).toEqual([]);
      expect(wrappedDocumentWithW3CDID.signature.merkleRoot).toBe(wrappedDocumentWithW3CDID.signature.targetHash);
      expect(wrappedDocumentWithW3CDID.data.issuer.identityProof.type).toContain(IdentityProofType.W3CDid);
      expect(wrappedDocumentWithW3CDID.data.issuer.identityProof.location).toContain(openAttestationDataWithW3CDID.issuer.identityProof.location);
    });
    test("checks that document is wrapped correctly", () => {
      const verified = verifySignature(wrappedDocument);
      expect(verified).toBe(true);
    });
    test("checks that document conforms to the schema", () => {
      expect(validateSchema(wrappedDocument)).toBe(true);
    });

    test("checks that data extracted are the same as input", () => {
      const data = getData(wrappedDocument);
      expect(data).toEqual(datum[0]);
    });

    test("does not allow for the same merkle root to be generated", () => {
      const newDocument = wrapDocument(document, { version: "open-attestation/3.0" });
      expect(wrappedDocument.signature.merkleRoot).not.toBe(newDocument.signature.merkleRoot);
    });

    test("obfuscate data correctly", async () => {
      const newDocument = wrapDocument(datum[2], { version: "open-attestation/3.0" });
      const obfuscatedDocument = obfuscateDocument(newDocument, ["key2"]);

      const verified = verifySignature(obfuscatedDocument);
      expect(verified).toBe(true);
      expect(validateSchema(obfuscatedDocument)).toBe(true);
    });

    test("obfuscate data transistively", () => {
      const newDocument = wrapDocument(datum[2], { version: "open-attestation/3.0" });
      const intermediateDocument = obfuscateDocument(newDocument, ["key2"]);
      const obfuscatedDocument = obfuscateDocument(intermediateDocument, ["key3"]);

      const comparison = obfuscateDocument(intermediateDocument, ["key2", "key3"]);

      expect(comparison).toEqual(obfuscatedDocument);
    });
  });

  describe("Issuing a batch of documents", () => {
    let signedDocuments: WrappedDocumentReturnType;

    beforeAll(() => {
      signedDocuments = wrapDocuments(datum, {
        externalSchemaId: "http://example.com/schema.json",
        version: "open-attestation/3.0"
      });
    });

    test("fails if there is a malformed document", () => {
      const malformedDatum = [
        ...datum,
        {
          cow: "moo"
        }
      ];
      const action = () => wrapDocument(malformedDatum);
      expect(action).toThrow("Invalid document");
    });

    test("creates a batch of documents if all are in the right format", () => {
      signedDocuments.forEach((doc: WrappedDocumentReturnType, i: number) => {
        expect(doc.schema).toBe("http://example.com/schema.json");
        expect(doc.signature.type).toBe("SHA3MerkleProof");
        expect(doc.data.key1).toEqual(expect.stringContaining(datum[i].key1));
        expect(doc.signature.targetHash).toBeDefined();
        expect(doc.signature.merkleRoot).toBeDefined();
        expect(doc.signature.proof.length).toEqual(2);
      });
    });

    test("checks that documents are wrapped correctly", () => {
      const verified = signedDocuments.reduce((prev: boolean, curr: boolean) => verifySignature(curr) && prev, true);
      expect(verified).toBe(true);
    });
    test("checks that documents conforms to the schema", () => {
      const validatedSchema = signedDocuments.reduce((prev: boolean, curr: any) => validateSchema(curr) && prev, true);
      expect(validatedSchema).toBe(true);
    });

    test("checks that data extracted are the same as input", () => {
      signedDocuments.forEach((doc: WrappedDocumentReturnType, i: number) => {
        const data = getData(doc);
        expect(data).toEqual(datum[i]);
      });
    });

    test("does not allow for same merkle root to be generated", () => {
      const newSignedDocuments = wrapDocuments(datum, { version: "open-attestation/3.0" });
      expect(signedDocuments[0].signature.merkleRoot).not.toBe(newSignedDocuments[0].signature.merkleRoot);
    });
  });

  describe("validate", () => {
    test("should throw an error if document id is not a valid open attestation schema version", () => {
      const action = () =>
        validateSchema({
          version: "abababa",
          schema: "http://example.com/schemaV3.json",
          data: {
            key: 2
          }
        });
      expect(action).toThrow("No schema validator provided");
    });
    test("should return false if document is not valid", () => {
      expect(
        validateSchema({
          version: "open-attestation/3.0",
          schema: "http://example.com/schemaV3.json",
          data: {
            key: 2
          }
        })
      ).toStrictEqual(false);
    });
    test("should return true when document is valid and version is 3.0", () => {
      expect(
        validateSchema({
          version: "open-attestation/3.0",
          schema: "http://example.com/schemaV3.json",
          data: {
            reference: "reference",
            name: "name",
            validFrom: "2010-01-01T19:23:24Z",
            issuer: {
              id: "https://example.com",
              name: "issuer.name",
              identityProof: {
                type: "DNS-TXT",
                location: "issuer.identityProof.location"
              }
            },
            template: {
              name: "template.name",
              type: "EMBEDDED_RENDERER",
              url: "https://example.com"
            },
            proof: {
              type: "OpenAttestationSignature2018",
              method: "TOKEN_REGISTRY",
              value: "proof.value"
            }
          }
        })
      ).toStrictEqual(true);
    });
    test("should return true when document is valid and version is 3.0 and identityProof is W3C-DID", () => {
      expect(
        validateSchema({
          version: "open-attestation/3.0",
          schema: "http://example.com/schemaV3.json",
          data: {
            reference: "reference",
            name: "name",
            validFrom: "2010-01-01T19:23:24Z",
            issuer: {
              id: "https://example.com",
              name: "issuer.name",
              identityProof: {
                type: IdentityProofType.W3CDid,
                location: openAttestationDataWithW3CDID.issuer.identityProof.location
              }
            },
            template: {
              name: "template.name",
              type: "EMBEDDED_RENDERER",
              url: "https://example.com"
            },
            proof: {
              type: "OpenAttestationSignature2018",
              method: "TOKEN_REGISTRY",
              value: "proof.value"
            }
          }
        })
      ).toStrictEqual(true);
    });
    test("should return false when document is invalid due to no W3D-DID location", () => {
      expect(
        validateSchema({
          version: "open-attestation/3.0",
          schema: "http://example.com/schemaV3.json",
          data: {
            reference: "reference",
            name: "name",
            validFrom: "2010-01-01T19:23:24Z",
            issuer: {
              id: "https://example.com",
              name: "issuer.name",
              identityProof: {
                type: IdentityProofType.W3CDid,
              }
            },
            template: {
              name: "template.name",
              type: "EMBEDDED_RENDERER",
              url: "https://example.com"
            },
            proof: {
              type: "OpenAttestationSignature2018",
              method: "TOKEN_REGISTRY",
              value: "proof.value"
            }
          }
        })
      ).toStrictEqual(false);
    });
    test("should return true when document is valid and version is not provided", () => {
      expect(
        validateSchema({
          data: {
            issuers: [
              {
                name: "issuer.name",
                certificateStore: "0x9178F546D3FF57D7A6352bD61B80cCCD46199C2d"
              }
            ]
          }
        })
      ).toStrictEqual(true);
    });
  });
});
