import type { CatalogRepository } from "./catalog-repository.ts";
import type { Manufacturer } from "./types.ts";
import { filterPublicManufacturers } from "./public-discovery.ts";

export class ManufacturerService {
  private readonly repository: CatalogRepository;

  constructor(repository: CatalogRepository) {
    this.repository = repository;
  }

  async getManufacturers(): Promise<readonly Manufacturer[]> {
    const [manufacturers, products] = await Promise.all([
      this.repository.getManufacturers(),
      this.repository.getActiveProducts(),
    ]);
    return filterPublicManufacturers(manufacturers, products);
  }

  async getManufacturerBySlug(slug: string): Promise<Manufacturer | null> {
    const manufacturers = await this.getManufacturers();
    return manufacturers.find((manufacturer) => manufacturer.slug === slug) ?? null;
  }
}
