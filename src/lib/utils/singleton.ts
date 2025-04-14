/**
 * Singleton factory function for creating singleton instances of classes or functions
 * 
 * This function supports two patterns:
 * 1. Pass a constructor function: singleton(MyClass)
 * 2. Pass an ID and factory function: singleton('my-id', () => new MyClass())
 * 
 * @param idOrConstructor Either a string ID or a class constructor
 * @param factory Optional factory function to create the instance
 * @returns A singleton instance
 */

// Define type for global singleton storage
type SingletonStorage = Record<string, unknown>;

// Ensure the global singleton storage exists
const getSingletonStorage = (): SingletonStorage => {
  // Use a specific property name on globalThis to avoid conflicts
  if (!(globalThis as Record<string, unknown>).__PHAIGO_SINGLETONS) {
    (globalThis as Record<string, unknown>).__PHAIGO_SINGLETONS = {};
  }
  return (globalThis as Record<string, unknown>).__PHAIGO_SINGLETONS as SingletonStorage;
};

export function singleton<T>(
  idOrConstructor: string | (new (...args: unknown[]) => T),
  factory?: () => T
): T {
  // Get the singleton storage
  const instances = getSingletonStorage();
  
  // Handle both patterns: singleton(MyClass) and singleton('my-id', factory)
  if (typeof idOrConstructor === 'string') {
    // Pattern: singleton('my-id', () => new MyClass())
    const id = idOrConstructor;
    
    if (!factory) {
      throw new Error(`Factory function is required when using string ID: ${id}`);
    }
    
    if (!instances[id]) {
      instances[id] = factory();
    }
    
    return instances[id] as T;
  } else {
    // Pattern: singleton(MyClass)
    const Constructor = idOrConstructor;
    const id = Constructor.name;
    
    if (!instances[id]) {
      instances[id] = new Constructor();
    }
    
    return instances[id] as T;
  }
}