import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import {
  CourierService,
  CourierError,
  DeliveryError,
} from '../../../src/modules/delivery/courier.service';
import type {
  CreateCourierInput,
  UpdateCourierInput,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  CourierStatus,
} from '../../../src/modules/delivery/types';

describe('CourierService — Cadastro e Gestão de Entregadores & Zonas de Entrega', () => {
  let db: Database;
  let service: CourierService;
  const defaultStoreId = 1;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CourierService(db);

    // Insere uma loja inativa para testes de validação de loja
    db.prepare(`
      INSERT INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, phone, email, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
      VALUES (99, 'LJ99', 'Filial Inativa Teste', 'Razao Teste', '99.999.999/0001-99', '123456789', 0, '(11) 9999-9999', 'lj99@teste.com', 'Rua Teste', '99', 'Bairro Teste', 'SP', 'SP', '01001-000', '3550308', 0)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  // =========================================================================
  // GESTÃO DE ENTREGADORES (couriers)
  // =========================================================================

  describe('Gestão de Entregadores — createCourier', () => {
    it('deve cadastrar um entregador com sucesso aplicando todos os defaults', () => {
      const input: CreateCourierInput = {
        storeId: defaultStoreId,
        name: 'Carlos Motoboy',
        cpf: '123.456.789-01',
        phone: '(11) 98888-7777',
      };

      const courier = service.createCourier(input);

      expect(courier.id).toBeGreaterThan(0);
      expect(courier.name).toBe('Carlos Motoboy');
      expect(courier.cpf).toBe('123.456.789-01');
      expect(courier.phone).toBe('(11) 98888-7777');
      expect(courier.storeId).toBe(defaultStoreId);

      // Verificação estrita dos defaults
      expect(courier.vehicleType).toBe('MOTO');
      expect(courier.commissionPerDelivery).toBe(3.0);
      expect(courier.dailyAllowance).toBe(0.0);
      expect(courier.status).toBe('AVAILABLE');
      expect(courier.isActive).toBe(true);

      // Compatibilidade snake_case
      expect(courier.vehicle_type).toBe('MOTO');
      expect(courier.commission_per_delivery).toBe(3.0);
      expect(courier.daily_allowance).toBe(0.0);
      expect(courier.is_active).toBe(1);
    });

    it('deve cadastrar um entregador com dados customizados completos', () => {
      const input: CreateCourierInput = {
        storeId: defaultStoreId,
        name: 'Roberto Bike',
        cpf: '234.567.890-12',
        phone: '(11) 97777-6666',
        vehicleType: 'BIKE',
        vehiclePlate: null,
        cnh: '98765432100',
        commissionPerDelivery: 5.5,
        dailyAllowance: 25.0,
        status: 'ON_DELIVERY',
        isActive: true,
      };

      const courier = service.createCourier(input);

      expect(courier.vehicleType).toBe('BIKE');
      expect(courier.cnh).toBe('98765432100');
      expect(courier.commissionPerDelivery).toBe(5.5);
      expect(courier.dailyAllowance).toBe(25.0);
      expect(courier.status).toBe('ON_DELIVERY');
    });

    it('deve lançar INVALID_CPF quando formato de CPF for inválido', () => {
      const inputInvalid: CreateCourierInput = {
        storeId: defaultStoreId,
        name: 'Motoboy Fake',
        cpf: '123.456', // incompleto
        phone: '(11) 90000-0000',
      };

      expect(() => service.createCourier(inputInvalid)).toThrowError(CourierError);
      expect(() => service.createCourier(inputInvalid)).toThrowError(/INVALID_CPF/);
    });

    it('deve lançar DUPLICATE_CPF quando CPF já estiver cadastrado (mesmo com ou sem máscara)', () => {
      service.createCourier({
        storeId: defaultStoreId,
        name: 'Entregador 1',
        cpf: '345.678.901-23',
        phone: '(11) 91111-1111',
      });

      // Tentativa de cadastrar o mesmo CPF sem pontuação
      const duplicateInput: CreateCourierInput = {
        storeId: defaultStoreId,
        name: 'Entregador 2',
        cpf: '34567890123',
        phone: '(11) 92222-2222',
      };

      expect(() => service.createCourier(duplicateInput)).toThrowError(CourierError);
      expect(() => service.createCourier(duplicateInput)).toThrowError(/DUPLICATE_CPF/);
    });

    it('deve lançar INVALID_NAME quando o nome for vazio ou apenas espaços', () => {
      const invalidNameInput: CreateCourierInput = {
        storeId: defaultStoreId,
        name: '   ',
        cpf: '456.789.012-34',
        phone: '(11) 93333-3333',
      };

      expect(() => service.createCourier(invalidNameInput)).toThrowError(/INVALID_NAME/);
    });

    it('deve lançar STORE_NOT_FOUND quando a loja não existir', () => {
      const invalidStoreInput: CreateCourierInput = {
        storeId: 9999, // Loja inexistente
        name: 'Motoboy Fantasma',
        cpf: '567.890.123-45',
        phone: '(11) 94444-4444',
      };

      expect(() => service.createCourier(invalidStoreInput)).toThrowError(/STORE_NOT_FOUND/);
    });

    it('deve lançar STORE_INACTIVE quando a loja estiver inativa', () => {
      const inactiveStoreInput: CreateCourierInput = {
        storeId: 99, // Loja inativa inserida no beforeEach
        name: 'Motoboy Loja Inativa',
        cpf: '678.901.234-56',
        phone: '(11) 95555-5555',
      };

      expect(() => service.createCourier(inactiveStoreInput)).toThrowError(/STORE_INACTIVE/);
    });
  });

  describe('Gestão de Entregadores — updateCourier', () => {
    it('deve atualizar dados cadastrais, veículo e comissões com sucesso', () => {
      const created = service.createCourier({
        storeId: defaultStoreId,
        name: 'Fernando Original',
        cpf: '789.012.345-67',
        phone: '(11) 96666-0000',
      });

      const updateInput: UpdateCourierInput = {
        name: 'Fernando Atualizado',
        phone: '(11) 96666-9999',
        vehicleType: 'CAR',
        vehiclePlate: 'XYZ-9876',
        commissionPerDelivery: 6.0,
        dailyAllowance: 15.0,
        isActive: true,
      };

      const updated = service.updateCourier(created.id, updateInput);

      expect(updated.name).toBe('Fernando Atualizado');
      expect(updated.phone).toBe('(11) 96666-9999');
      expect(updated.vehicleType).toBe('CAR');
      expect(updated.vehiclePlate).toBe('XYZ-9876');
      expect(updated.commissionPerDelivery).toBe(6.0);
      expect(updated.dailyAllowance).toBe(15.0);
    });

    it('deve lançar DUPLICATE_CPF quando atualizar CPF para um já existente de outro entregador', () => {
      const c1 = service.createCourier({
        storeId: defaultStoreId,
        name: 'Entregador A',
        cpf: '111.111.111-11',
        phone: '(11) 91111-0001',
      });

      const c2 = service.createCourier({
        storeId: defaultStoreId,
        name: 'Entregador B',
        cpf: '222.222.222-22',
        phone: '(11) 92222-0002',
      });

      // Tentativa de atualizar c2 com o CPF de c1
      expect(() =>
        service.updateCourier(c2.id, { cpf: '111.111.111-11' })
      ).toThrowError(/DUPLICATE_CPF/);

      // Atualizar o próprio c1 mantendo seu CPF não deve lançar erro
      expect(() =>
        service.updateCourier(c1.id, { cpf: '111.111.111-11', name: 'Entregador A Modificado' })
      ).not.toThrow();
    });

    it('deve lançar COURIER_NOT_FOUND ao tentar atualizar entregador inexistente', () => {
      expect(() =>
        service.updateCourier(9999, { name: 'Inexistente' })
      ).toThrowError(/COURIER_NOT_FOUND/);
    });
  });

  describe('Gestão de Entregadores — getCourierById & getCourierByCpf', () => {
    it('deve buscar entregador por ID e retornar null se não existir', () => {
      const created = service.createCourier({
        storeId: defaultStoreId,
        name: 'Julio Cesar',
        cpf: '333.444.555-66',
        phone: '(11) 93333-4444',
      });

      const found = service.getCourierById(created.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Julio Cesar');

      const notFound = service.getCourierById(8888);
      expect(notFound).toBeNull();
    });

    it('deve buscar tolerante a máscara de CPF (com ou sem pontuação)', () => {
      service.createCourier({
        storeId: defaultStoreId,
        name: 'Marcos Mask Test',
        cpf: '444.555.666-77',
        phone: '(11) 94444-5555',
      });

      // Busca sem máscara
      const foundClean = service.getCourierByCpf('44455566677');
      expect(foundClean).not.toBeNull();
      expect(foundClean?.name).toBe('Marcos Mask Test');

      // Busca com máscara idêntica
      const foundMasked = service.getCourierByCpf('444.555.666-77');
      expect(foundMasked).not.toBeNull();
      expect(foundMasked?.id).toBe(foundClean?.id);

      // Busca inexistente
      expect(service.getCourierByCpf('000.000.000-00')).toBeNull();
    });
  });

  describe('Gestão de Entregadores — listCouriers', () => {
    beforeEach(() => {
      service.createCourier({
        storeId: defaultStoreId,
        name: 'Ana Motogirl',
        cpf: '555.666.777-88',
        phone: '(11) 95555-6666',
        status: 'AVAILABLE',
        vehicleType: 'MOTO',
        isActive: true,
      });

      service.createCourier({
        storeId: defaultStoreId,
        name: 'Bruno Bike',
        cpf: '666.777.888-99',
        phone: '(11) 96666-7777',
        status: 'ON_DELIVERY',
        vehicleType: 'BIKE',
        isActive: true,
      });

      service.createCourier({
        storeId: defaultStoreId,
        name: 'Carlos Inativo',
        cpf: '777.888.999-00',
        phone: '(11) 97777-8888',
        status: 'INACTIVE',
        vehicleType: 'MOTO',
        isActive: false,
      });
    });

    it('deve listar todos os entregadores e filtrar por activeOnly', () => {
      const all = service.listCouriers();
      expect(all.length).toBeGreaterThanOrEqual(3);

      const activeOnly = service.listCouriers({ activeOnly: true });
      expect(activeOnly.every(c => c.isActive)).toBe(true);
      expect(activeOnly.find(c => c.name === 'Carlos Inativo')).toBeUndefined();
    });

    it('deve filtrar por status operacional (AVAILABLE, ON_DELIVERY, INACTIVE)', () => {
      const onDelivery = service.listCouriers({ status: 'ON_DELIVERY' });
      expect(onDelivery.some(c => c.name === 'Bruno Bike')).toBe(true);
      expect(onDelivery.every(c => c.status === 'ON_DELIVERY')).toBe(true);
    });

    it('deve realizar busca textual por nome, telefone ou CPF', () => {
      const byName = service.listCouriers({ search: 'Ana' });
      expect(byName.length).toBe(1);
      expect(byName[0].name).toBe('Ana Motogirl');

      const byPhone = service.listCouriers({ search: '96666-7777' });
      expect(byPhone.length).toBe(1);
      expect(byPhone[0].name).toBe('Bruno Bike');

      const byCpf = service.listCouriers({ search: '55566677788' });
      expect(byCpf.length).toBe(1);
      expect(byCpf[0].name).toBe('Ana Motogirl');
    });
  });

  describe('Gestão de Entregadores — updateCourierStatus', () => {
    it('deve atualizar o status operacional do motoboy', () => {
      const courier = service.createCourier({
        storeId: defaultStoreId,
        name: 'Diego Entrega',
        cpf: '888.999.000-11',
        phone: '(11) 98888-0000',
      });

      expect(courier.status).toBe('AVAILABLE');

      const dispatched = service.updateCourierStatus(courier.id, 'ON_DELIVERY');
      expect(dispatched.status).toBe('ON_DELIVERY');

      const available = service.updateCourierStatus(courier.id, 'AVAILABLE');
      expect(available.status).toBe('AVAILABLE');
    });

    it('deve lançar INVALID_STATUS para status inválido', () => {
      const courier = service.createCourier({
        storeId: defaultStoreId,
        name: 'Elton Motoboy',
        cpf: '999.000.111-22',
        phone: '(11) 99999-0000',
      });

      expect(() =>
        service.updateCourierStatus(courier.id, 'STATUS_INVALIDO' as CourierStatus)
      ).toThrowError(/INVALID_STATUS/);
    });

    it('deve lançar COURIER_NOT_FOUND para ID inexistente', () => {
      expect(() =>
        service.updateCourierStatus(7777, 'ON_DELIVERY')
      ).toThrowError(/COURIER_NOT_FOUND/);
    });
  });

  // =========================================================================
  // GESTÃO DE ZONAS DE ENTREGA (delivery_zones)
  // =========================================================================

  describe('Gestão de Zonas de Entrega — createDeliveryZone', () => {
    it('deve criar zona de entrega com sucesso aplicando defaults', () => {
      const input: CreateDeliveryZoneInput = {
        storeId: defaultStoreId,
        name: 'Zona Norte - Santana',
        neighborhood: 'Santana',
        city: 'São Paulo',
        deliveryFee: 10.0,
      };

      const zone = service.createDeliveryZone(input);

      expect(zone.id).toBeGreaterThan(0);
      expect(zone.name).toBe('Zona Norte - Santana');
      expect(zone.neighborhood).toBe('Santana');
      expect(zone.city).toBe('São Paulo');
      expect(zone.state).toBe('SP');
      expect(zone.deliveryFee).toBe(10.0);
      expect(zone.estimatedMinutes).toBe(40); // default
      expect(zone.isActive).toBe(true);

      // Compatibilidade snake_case
      expect(zone.delivery_fee).toBe(10.0);
      expect(zone.estimated_minutes).toBe(40);
      expect(zone.is_active).toBe(1);
    });

    it('deve criar zona com teto de frete grátis e tempo estimado customizado', () => {
      const input: CreateDeliveryZoneInput = {
        storeId: defaultStoreId,
        name: 'Zona Sul - Moema Express',
        neighborhood: 'Moema',
        city: 'São Paulo',
        state: 'SP',
        deliveryFee: 12.0,
        estimatedMinutes: 25,
        freeShippingThreshold: 100.0,
        isActive: true,
      };

      const zone = service.createDeliveryZone(input);

      expect(zone.estimatedMinutes).toBe(25);
      expect(zone.freeShippingThreshold).toBe(100.0);
    });

    it('deve lançar INVALID_DELIVERY_FEE se taxa de entrega for negativa', () => {
      const input: CreateDeliveryZoneInput = {
        storeId: defaultStoreId,
        name: 'Zona Inválida',
        neighborhood: 'Bairro X',
        city: 'São Paulo',
        deliveryFee: -5.0,
      };

      expect(() => service.createDeliveryZone(input)).toThrowError(/INVALID_DELIVERY_FEE/);
    });

    it('deve lançar INVALID_ESTIMATED_MINUTES se tempo for menor ou igual a zero', () => {
      const input: CreateDeliveryZoneInput = {
        storeId: defaultStoreId,
        name: 'Zona Tempo Zero',
        neighborhood: 'Bairro Y',
        city: 'São Paulo',
        deliveryFee: 5.0,
        estimatedMinutes: 0,
      };

      expect(() => service.createDeliveryZone(input)).toThrowError(/INVALID_ESTIMATED_MINUTES/);
    });
  });

  describe('Gestão de Zonas de Entrega — updateDeliveryZone', () => {
    it('deve atualizar parâmetros de taxa, tempo estimado e teto de frete grátis', () => {
      const created = service.createDeliveryZone({
        storeId: defaultStoreId,
        name: 'Zona Leste - Tatuapé',
        neighborhood: 'Tatuapé',
        city: 'São Paulo',
        deliveryFee: 9.0,
        estimatedMinutes: 45,
      });

      const updateInput: UpdateDeliveryZoneInput = {
        deliveryFee: 11.5,
        estimatedMinutes: 35,
        freeShippingThreshold: 120.0,
      };

      const updated = service.updateDeliveryZone(created.id, updateInput);

      expect(updated.deliveryFee).toBe(11.5);
      expect(updated.estimatedMinutes).toBe(35);
      expect(updated.freeShippingThreshold).toBe(120.0);
    });

    it('deve lançar ZONE_NOT_FOUND ao tentar atualizar zona inexistente', () => {
      expect(() =>
        service.updateDeliveryZone(9999, { deliveryFee: 15.0 })
      ).toThrowError(/ZONE_NOT_FOUND/);
    });
  });

  describe('Gestão de Zonas de Entrega — getDeliveryZoneById & listDeliveryZones', () => {
    it('deve buscar por ID e listar com filtros por loja e status', () => {
      const zone1 = service.createDeliveryZone({
        storeId: defaultStoreId,
        name: 'Zona Bela Vista',
        neighborhood: 'Bela Vista Nova',
        city: 'São Paulo',
        deliveryFee: 6.0,
      });

      const found = service.getDeliveryZoneById(zone1.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Zona Bela Vista');

      const list = service.listDeliveryZones({ activeOnly: true });
      expect(list.some(z => z.id === zone1.id)).toBe(true);
    });
  });

  describe('Gestão de Zonas de Entrega — deleteDeliveryZone', () => {
    it('deve excluir uma zona de entrega existente', () => {
      const zone = service.createDeliveryZone({
        storeId: defaultStoreId,
        name: 'Zona Temporária',
        neighborhood: 'Bairro Temp',
        city: 'São Paulo',
        deliveryFee: 7.0,
      });

      const success = service.deleteDeliveryZone(zone.id);
      expect(success).toBe(true);

      const found = service.getDeliveryZoneById(zone.id);
      expect(found).toBeNull();
    });

    it('deve lançar ZONE_NOT_FOUND ao tentar excluir zona inexistente', () => {
      expect(() => service.deleteDeliveryZone(8888)).toThrowError(/ZONE_NOT_FOUND/);
    });
  });

  describe('Cálculo de Taxas e Frete Grátis — calculateDeliveryFee', () => {
    beforeEach(() => {
      // Cadastra zona com regra de frete grátis a partir de R$ 80,00
      service.createDeliveryZone({
        storeId: defaultStoreId,
        name: 'Jardim Paulista Zona',
        neighborhood: 'Jardim Paulista',
        city: 'São Paulo',
        deliveryFee: 8.5,
        estimatedMinutes: 30,
        freeShippingThreshold: 80.0,
        isActive: true,
      });
    });

    it('deve retornar a taxa cadastrada e tempo estimado para o bairro cadastrado', () => {
      const result = service.calculateDeliveryFee({
        storeId: defaultStoreId,
        neighborhood: 'Jardim Paulista',
        city: 'São Paulo',
        subtotalAmount: 50.0, // Abaixo do teto de R$ 80,00
      });

      expect(result.fee).toBe(8.5);
      expect(result.estimatedMinutes).toBe(30);
      expect(result.isFree).toBe(false);
      expect(result.zone).not.toBeNull();
      expect(result.zone?.neighborhood).toBe('Jardim Paulista');
    });

    it('deve conceder frete grátis (fee: 0, isFree: true) se subtotal atingir o freeShippingThreshold', () => {
      const resultExact = service.calculateDeliveryFee({
        storeId: defaultStoreId,
        neighborhood: 'Jardim Paulista',
        city: 'São Paulo',
        subtotalAmount: 80.0, // Exatamente no teto
      });

      expect(resultExact.fee).toBe(0.0);
      expect(resultExact.isFree).toBe(true);
      expect(resultExact.estimatedMinutes).toBe(30);

      const resultAbove = service.calculateDeliveryFee({
        storeId: defaultStoreId,
        neighborhood: 'Jardim Paulista',
        city: 'São Paulo',
        subtotalAmount: 150.0, // Acima do teto
      });

      expect(resultAbove.fee).toBe(0.0);
      expect(resultAbove.isFree).toBe(true);
    });

    it('deve retornar valores padrão de fallback se o bairro não estiver cadastrado', () => {
      const resultFallback = service.calculateDeliveryFee({
        storeId: defaultStoreId,
        neighborhood: 'Bairro Remoto Não Cadastrado',
        city: 'São Paulo',
        subtotalAmount: 40.0,
      });

      expect(resultFallback.fee).toBe(5.0); // Fallback padrão
      expect(resultFallback.estimatedMinutes).toBe(40); // Fallback padrão
      expect(resultFallback.isFree).toBe(false);
      expect(resultFallback.zone).toBeNull();
    });

    it('deve aceitar parâmetros posicionais para compatibilidade', () => {
      const result = service.calculateDeliveryFee(
        'Jardim Paulista',
        'São Paulo',
        100.0,
        defaultStoreId
      );

      expect(result.fee).toBe(0.0);
      expect(result.isFree).toBe(true);
      expect(result.estimatedMinutes).toBe(30);
    });
  });
});
